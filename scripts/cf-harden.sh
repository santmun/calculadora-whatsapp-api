#!/usr/bin/env bash
# Blinda TU zona (dominio) en Cloudflare vía API.
# Requiere: export CF_ZONE_TOKEN=... (permisos: Zone Settings:Edit, Zone WAF:Edit, DNS:Edit, Zone:Read, Bot Management:Edit)
# (se llama CF_ZONE_TOKEN y no CLOUDFLARE_API_TOKEN a propósito: si no, wrangler lo usaría para deploy y fallaría por falta de permisos de Workers)
# Uso: ./scripts/cf-harden.sh tudominio.com            (aplica todo)
#      ./scripts/cf-harden.sh tudominio.com --check    (solo lee el estado, no cambia nada)
set -euo pipefail
ZONE_NAME="${1:?Uso: cf-harden.sh tudominio.com [--check]}"
API="https://api.cloudflare.com/client/v4"
TOKEN="${CF_ZONE_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
: "${TOKEN:?Falta CF_ZONE_TOKEN en el entorno}"
H=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
CHECK="${2:-}"

cf() { curl -sS "${H[@]}" "$@"; }
ok() { python3 -c 'import sys,json; j=json.load(sys.stdin); print("✅" if j.get("success") else "❌ "+json.dumps(j.get("errors")))'; }

ZONE_ID=$(cf "$API/zones?name=$ZONE_NAME" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"][0]["id"])')
echo "zona $ZONE_NAME → $ZONE_ID"

echo "── Estado actual"
for s in always_use_https min_tls_version tls_1_3 automatic_https_rewrites security_level; do
  printf "  %-26s " "$s"; cf "$API/zones/$ZONE_ID/settings/$s" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["value"])'
done
printf "  %-26s " "bot_fight_mode"; cf "$API/zones/$ZONE_ID/bot_management" | python3 -c 'import sys,json; r=json.load(sys.stdin).get("result",{}); print(r.get("fight_mode"))'
printf "  %-26s " "dnssec"; cf "$API/zones/$ZONE_ID/dnssec" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["status"])'
echo "  DNS TXT/CAA:"; cf "$API/zones/$ZONE_ID/dns_records?type=TXT" | python3 -c 'import sys,json; [print("   ", r["name"], "→", r["content"]) for r in json.load(sys.stdin)["result"]]'
cf "$API/zones/$ZONE_ID/dns_records?type=CAA" | python3 -c 'import sys,json; [print("    CAA", r["name"], "→", r["content"]) for r in json.load(sys.stdin)["result"]]'
[ "$CHECK" = "--check" ] && exit 0

echo "── 1. HTTPS siempre + TLS mínimo 1.2 + reescritura automática a HTTPS"
printf "  always_use_https " ; cf -X PATCH "$API/zones/$ZONE_ID/settings/always_use_https" --data '{"value":"on"}' | ok
printf "  min_tls_version  " ; cf -X PATCH "$API/zones/$ZONE_ID/settings/min_tls_version" --data '{"value":"1.2"}' | ok
printf "  https_rewrites   " ; cf -X PATCH "$API/zones/$ZONE_ID/settings/automatic_https_rewrites" --data '{"value":"on"}' | ok

echo "── 2. Bot Fight Mode"
printf "  fight_mode       " ; cf -X PUT "$API/zones/$ZONE_ID/bot_management" --data '{"enable_js":true,"fight_mode":true}' | ok

echo "── 3. WAF: Cloudflare Free Managed Ruleset (phase http_request_firewall_managed)"
# Busca el ruleset gratuito por nombre (los IDs de rulesets administrados no conviene hardcodearlos)
FREE_RULESET=$(cf "$API/zones/$ZONE_ID/rulesets" | python3 -c 'import sys,json; r=[x for x in json.load(sys.stdin)["result"] if x.get("kind")=="managed" and x.get("phase")=="http_request_firewall_managed" and "Free" in x.get("name","")]; print(r[0]["id"] if r else "")')
[ -z "$FREE_RULESET" ] && { echo "  no encontré el 'Cloudflare Free Managed Ruleset' en la lista de rulesets (¿ya viene activo por default en el plan Free?)"; }
ENTRY=$(cf "$API/zones/$ZONE_ID/rulesets/phases/http_request_firewall_managed/entrypoint" || true)
if [ -z "$FREE_RULESET" ]; then :; elif echo "$ENTRY" | grep -q "$FREE_RULESET"; then echo "  ya desplegado ✅"; else
  printf "  desplegando      "; cf -X PUT "$API/zones/$ZONE_ID/rulesets/phases/http_request_firewall_managed/entrypoint" --data "{\"rules\":[{\"action\":\"execute\",\"action_parameters\":{\"id\":\"$FREE_RULESET\"},\"expression\":\"true\",\"description\":\"Cloudflare Free Managed Ruleset\",\"enabled\":true}]}" | ok
fi

echo "── 4. Rate Limiting: máx 300 requests / 10 s por IP (una carga de página son ~25); bloqueo 10 s"
RL=$(cf "$API/zones/$ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" || true)
if echo "$RL" | grep -q "calculadora-rate-limit"; then echo "  ya existe ✅"; else
  printf "  creando          "; cf -X PUT "$API/zones/$ZONE_ID/rulesets/phases/http_ratelimit/entrypoint" --data '{"rules":[{"action":"block","description":"calculadora-rate-limit","enabled":true,"expression":"(http.host eq \"'"$ZONE_NAME"'\")","ratelimit":{"characteristics":["ip.src","cf.colo.id"],"period":10,"requests_per_period":300,"mitigation_timeout":10}}]}' | ok
fi

echo "── 5. DNSSEC"
printf "  dnssec           " ; cf -X PATCH "$API/zones/$ZONE_ID/dnssec" --data '{"status":"active"}' | ok

echo "── 6. Anti-suplantación de correo (el dominio NO envía email) + CAA"
add_record() { # type name content
  local existing; existing=$(cf "$API/zones/$ZONE_ID/dns_records?type=$1&name=$2" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["result"]))')
  if [ "$existing" != "0" ]; then echo "  $1 $2 ya existe ✅"; return; fi
  printf "  %s %s  " "$1" "$2"; cf -X POST "$API/zones/$ZONE_ID/dns_records" --data "{\"type\":\"$1\",\"name\":\"$2\",\"content\":$3,\"ttl\":3600}" | ok
}
add_record TXT "$ZONE_NAME" '"v=spf1 -all"'
add_record TXT "_dmarc.$ZONE_NAME" '"v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s"'
add_record TXT "*._domainkey.$ZONE_NAME" '"v=DKIM1; p="'
# CAA: solo Let's Encrypt, Google Trust Services y DigiCert (las CAs que usa Cloudflare) pueden emitir certificados
for ca in letsencrypt.org pki.goog digicert.com; do
  n=$(cf "$API/zones/$ZONE_ID/dns_records?type=CAA&name=$ZONE_NAME" | python3 -c "import sys,json; print(sum(1 for r in json.load(sys.stdin)['result'] if '$ca' in r['content']))")
  if [ "$n" != "0" ]; then echo "  CAA $ca ya existe ✅"; continue; fi
  printf "  CAA %s  " "$ca"; cf -X POST "$API/zones/$ZONE_ID/dns_records" --data "{\"type\":\"CAA\",\"name\":\"$ZONE_NAME\",\"data\":{\"flags\":0,\"tag\":\"issue\",\"value\":\"$ca\"},\"ttl\":3600}" | ok
done
echo "Listo. Corre con --check para ver el estado final."
