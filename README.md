# Enonic XP data query

Intern service for å kjøre queries mot innhold i [Enonic XP](https://github.com/navikt/nav-enonicxp) CMS'et for nav.no. For å hindre overbelastning håndterer denne maks 3 samtidige requests (gir 503-feil når denne grensen er nådd).

#### Ingress for prod-data
Henter data fra www.nav.no:  
[https://nav-enonicxp-dataquery.intern.nav.no/query](https://nav-enonicxp-dataquery.intern.nav.no/query)  
[[Logger](https://logs.adeo.no/goto/32b96e48bef962beda8465a62bc5b8bc)]

#### Ingress for dev-data
Henter data fra www.dev.nav.no:  
[https://nav-enonicxp-dataquery.dev.intern.nav.no/query](https://nav-enonicxp-dataquery.dev.intern.nav.no/query)  
[[Logger](https://logs.adeo.no/goto/7fe57e567121032648513ec3ea6ad585)]

## Request

### Parametre

branch er påkrevd, resten er optional

| Parameter          | Gyldige verdier
| ------------------ | -----------------------------------------------------
| branch             | published, unpublished
| query              | NoQL query string ([se dokumentasjon](https://developer.enonic.com/docs/xp/stable/storage/noql#query)) - hvis tom hentes alt innhold fra valgt branch
| types              | array av content-typer queryet skal kjøres mot - hvis tom benyttes default typer [1]

[1] Default content-typer:
```
'no.nav.navno:situation-page'
'no.nav.navno:dynamic-page'
'no.nav.navno:content-page-with-sidemenus'
'no.nav.navno:main-article'
'no.nav.navno:section-page'
'no.nav.navno:page-list'
'no.nav.navno:transport-page'
'no.nav.navno:office-information'
'no.nav.navno:publishing-calendar'
'no.nav.navno:large-table'
'media:text'
'media:document'
'media:spreadsheet'
'media:presentation'
```

### Eksempler
Returnerer ALT publisert innhold:
```
https://nav-enonicxp-dataquery.intern.nav.no/query?branch=published
```

Returnerer upublisert innhold med innholdstype main-article som inneholder "foo" eller "bar" i artikkelteksten:
```
https://nav-enonicxp-dataquery.intern.nav.no/query?branch=unpublished&types=["no.nav.navno:main-article"]&query=fulltext("data.text", "foo bar", "OR")
```

## Response

```
{
    "message": "Processing query - total hit count <hits>",
    "hits": <antall forventede treff>,
    "requestId": <unik id for requesten>,
    "resultUrl": "https://nav-enonicxp-dataquery.intern.nav.no/result/<requestId>"
}
```

requestUrl vil servere en zip-fil med resultatet når det er klart. Ellers returneres denne responsen:

```
{
    "message": "Result is not ready - Query progress: <progress>",
    "progress": <0-100>
}
```

Oversikt over alle tilgjengelige resultater finnes her:\
[https://nav-enonicxp-dataquery.intern.nav.no/result](https://nav-enonicxp-dataquery.intern.nav.no/result) (prod)\
[https://nav-enonicxp-dataquery.dev.intern.nav.no/result](https://nav-enonicxp-dataquery.dev.intern.nav.no/result) (dev)
