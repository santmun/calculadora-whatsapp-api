#!/usr/bin/env python3
"""Genera public/data.js a partir de data/rates_oct2026.json (rate card oficial de Meta,
vigente 1 oct 2026, parseado de los PDFs "Tarifas y niveles de volumen en <MONEDA>") y
del mapeo país -> mercado de precios que publica Meta en
https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#country-calling-codes
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
rates = json.load(open(ROOT / "data/rates_oct2026.json"))

# (iso, nombre en español, código de llamada, mercado en el rate card, moneda local de facturación de Meta o None)
C = []
def add(iso, name, cc, market, cur=None): C.append(dict(iso=iso, name=name, cc=cc, market=market, cur=cur))

# Mercados independientes en el rate card del 1 oct 2026
add("MX", "México", "52", "Mexico", "MXN")
add("BR", "Brasil", "55", "Brazil", "BRL")
add("CO", "Colombia", "57", "Colombia", "COP")
add("AR", "Argentina", "54", "Argentina", "ARS")
add("CL", "Chile", "56", "Chile", "CLP")
add("PE", "Perú", "51", "Peru", "PEN")
add("ES", "España", "34", "Spain", "EUR")
add("US", "Estados Unidos", "1", "North America")
add("CA", "Canadá", "1", "North America")
add("GB", "Reino Unido", "44", "United Kingdom", "GBP")
add("FR", "Francia", "33", "France", "EUR")
add("DE", "Alemania", "49", "Germany", "EUR")
add("IT", "Italia", "39", "Italy", "EUR")
add("NL", "Países Bajos", "31", "Netherlands", "EUR")
add("PL", "Polonia", "48", "Poland")
add("HU", "Hungría", "36", "Hungary")
add("RO", "Rumania", "40", "Romania")
add("UA", "Ucrania", "380", "Ukraine")
add("RU", "Rusia", "7", "Russia")
add("KZ", "Kazajistán", "7", "Kazakhstan")
add("TR", "Turquía", "90", "Turkey")
add("IL", "Israel", "972", "Israel")
add("SA", "Arabia Saudita", "966", "Saudi Arabia", "SAR")
add("AE", "Emiratos Árabes Unidos", "971", "United Arab Emirates", "AED")
add("QA", "Catar", "974", "Qatar")
add("KW", "Kuwait", "965", "Kuwait")
add("OM", "Omán", "968", "Oman")
add("IQ", "Irak", "964", "Iraq")
add("EG", "Egipto", "20", "Egypt")
add("MA", "Marruecos", "212", "Morocco")
add("NG", "Nigeria", "234", "Nigeria")
add("ZA", "Sudáfrica", "27", "South Africa")
add("IN", "India", "91", "India", "INR")
add("PK", "Pakistán", "92", "Pakistan")
add("BD", "Bangladesh", "880", "Bangladesh")
add("NP", "Nepal", "977", "Nepal")
add("LK", "Sri Lanka", "94", "Sri Lanka")
add("ID", "Indonesia", "62", "Indonesia", "IDR")
add("MY", "Malasia", "60", "Malaysia", "MYR")
add("SG", "Singapur", "65", "Singapore", "SGD")
add("HK", "Hong Kong", "852", "Hong Kong")

# Resto de Latinoamérica
for iso, name, cc in [("GT","Guatemala","502"),("SV","El Salvador","503"),("HN","Honduras","504"),("NI","Nicaragua","505"),
    ("CR","Costa Rica","506"),("PA","Panamá","507"),("DO","República Dominicana","1"),("PR","Puerto Rico","1"),
    ("EC","Ecuador","593"),("BO","Bolivia","591"),("PY","Paraguay","595"),("UY","Uruguay","598"),("VE","Venezuela","58"),
    ("HT","Haití","509"),("JM","Jamaica","1")]:
    add(iso, name, cc, "Rest of Latin America")

# Resto de Europa Occidental
for iso, name, cc, cur in [("PT","Portugal","351","EUR"),("IE","Irlanda","353","EUR"),("BE","Bélgica","32","EUR"),("AT","Austria","43","EUR"),
    ("FI","Finlandia","358","EUR"),("DK","Dinamarca","45",None),("SE","Suecia","46",None),("NO","Noruega","47",None),("CH","Suiza","41",None)]:
    add(iso, name, cc, "Rest of Western Europe", cur)

# Resto de Europa Central y Oriental
for iso, name, cc, cur in [("GR","Grecia","30","EUR"),("CZ","República Checa","420",None),("SK","Eslovaquia","421","EUR"),("SI","Eslovenia","386","EUR"),
    ("HR","Croacia","385","EUR"),("BG","Bulgaria","359",None),("RS","Serbia","381",None),("LT","Lituania","370","EUR"),("LV","Letonia","371","EUR"),
    ("MD","Moldavia","373",None),("MK","Macedonia del Norte","389",None),("AL","Albania","355",None),("GE","Georgia","995",None),
    ("AM","Armenia","374",None),("AZ","Azerbaiyán","994",None),("BY","Bielorrusia","375",None)]:
    add(iso, name, cc, "Rest of Central & Eastern Europe", cur)

# Resto de Medio Oriente
for iso, name, cc in [("JO","Jordania","962"),("LB","Líbano","961"),("BH","Baréin","973"),("YE","Yemen","967")]:
    add(iso, name, cc, "Rest of Middle East")

# Resto de África
for iso, name, cc in [("DZ","Argelia","213"),("TN","Túnez","216"),("LY","Libia","218"),("KE","Kenia","254"),("GH","Ghana","233"),
    ("CI","Costa de Marfil","225"),("SN","Senegal","221"),("CM","Camerún","237"),("ET","Etiopía","251"),("TZ","Tanzania","255"),
    ("UG","Uganda","256"),("AO","Angola","244"),("MZ","Mozambique","258"),("ZM","Zambia","260"),("ZW","Zimbabue","263"),
    ("BW","Botsuana","267"),("NA","Namibia","264"),("RW","Ruanda","250"),("MG","Madagascar","261"),("ML","Mali","223"),
    ("BF","Burkina Faso","226"),("NE","Níger","227"),("TD","Chad","235"),("BJ","Benín","229"),("TG","Togo","228"),
    ("GM","Gambia","220"),("GW","Guinea-Bisáu","245"),("SL","Sierra Leona","232"),("LR","Liberia","231"),("MR","Mauritania","222"),
    ("GA","Gabón","241"),("CG","República del Congo","242"),("BI","Burundi","257"),("ER","Eritrea","291"),("SO","Somalia","252"),
    ("SD","Sudán","249"),("SS","Sudán del Sur","211"),("MW","Malaui","265"),("LS","Lesoto","266"),("SZ","Esuatini (Suazilandia)","268")]:
    add(iso, name, cc, "Rest of Africa")

# Resto de Asia-Pacífico
for iso, name, cc, cur in [("AU","Australia","61","AUD"),("NZ","Nueva Zelanda","64",None),("JP","Japón","81",None),("CN","China","86",None),
    ("TW","Taiwán","886",None),("PH","Filipinas","63",None),("TH","Tailandia","66",None),("VN","Vietnam","84",None),("KH","Camboya","855",None),
    ("LA","Laos","856",None),("MN","Mongolia","976",None),("AF","Afganistán","93",None),("UZ","Uzbekistán","998",None),
    ("TJ","Tayikistán","992",None),("TM","Turkmenistán","993",None),("PG","Papúa Nueva Guinea","675",None)]:
    add(iso, name, cc, "Rest of Asia Pacific", cur)

# "Other" (países no listados por Meta). Algunos comunes explícitos + opción genérica.
for iso, name, cc, cur in [("CU","Cuba","53",None),("BZ","Belice","501",None),("GY","Guyana","592",None),("SR","Surinam","597",None),
    ("TT","Trinidad y Tobago","1",None),("KR","Corea del Sur","82",None),("LU","Luxemburgo","352","EUR"),("CY","Chipre","357","EUR"),
    ("MT","Malta","356","EUR"),("EE","Estonia","372","EUR"),("IS","Islandia","354",None)]:
    add(iso, name, cc, "Other", cur)
add("XX", "Otro país (no listado)", "", "Other")

markets = sorted(rates["USD"]["rows"].keys())
for c in C:
    assert c["market"] in markets, c
    if c["cur"]: assert c["cur"] in rates, c

MARKET_ES = {
    "Argentina":"Argentina","Bangladesh":"Bangladesh","Brazil":"Brasil","Chile":"Chile","Colombia":"Colombia","Egypt":"Egipto",
    "France":"Francia","Germany":"Alemania","Hong Kong":"Hong Kong","Hungary":"Hungría","India":"India","Indonesia":"Indonesia",
    "Iraq":"Irak","Israel":"Israel","Italy":"Italia","Kazakhstan":"Kazajistán","Kuwait":"Kuwait","Malaysia":"Malasia","Mexico":"México",
    "Morocco":"Marruecos","Netherlands":"Países Bajos","Nepal":"Nepal","Nigeria":"Nigeria","Oman":"Omán","Pakistan":"Pakistán","Peru":"Perú",
    "Poland":"Polonia","Qatar":"Catar","Romania":"Rumania","Russia":"Rusia","Saudi Arabia":"Arabia Saudita","Singapore":"Singapur",
    "South Africa":"Sudáfrica","Spain":"España","Sri Lanka":"Sri Lanka","Turkey":"Turquía","Ukraine":"Ucrania",
    "United Arab Emirates":"Emiratos Árabes Unidos","United Kingdom":"Reino Unido","North America":"Norteamérica (EE. UU. y Canadá)",
    "Rest of Africa":"Resto de África","Rest of Asia Pacific":"Resto de Asia-Pacífico",
    "Rest of Central & Eastern Europe":"Resto de Europa Central y Oriental","Rest of Latin America":"Resto de Latinoamérica",
    "Rest of Middle East":"Resto de Medio Oriente","Rest of Western Europe":"Resto de Europa Occidental","Other":"Otros países",
}
assert set(MARKET_ES) == set(markets)

out = {
    "meta": {
        "effective": "2026-10-01",
        "freeServicePerNumber": 1000,
        "source": "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing#updates-to-rate-cards",
        "generated": "2026-09-05",
    },
    "rates": {cur: v["rows"] for cur, v in rates.items()},
    "marketNames": MARKET_ES,
    "countries": C,
}
js = "// GENERADO por scripts/build-data.py — no editar a mano.\n// Fuente: rate cards oficiales de Meta vigentes 1 oct 2026 (16 monedas).\nexport const DATA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
(ROOT / "public/data.js").write_text(js)
print("public/data.js:", len(js), "bytes;", len(C), "países;", len(markets), "mercados;", len(rates), "monedas")
