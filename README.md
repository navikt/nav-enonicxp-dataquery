Intern service for å kjøre queries mot innhold i Enonic XP. For å hindre overbelastning har denne ingen concurrency (gir 503-feil dersom servicen er i bruk).

#### Dev url
[https://nav-enonicxp-dataquery.intern.dev.nav.no/query](https://nav-enonicxp-dataquery.intern.dev.nav.no/data)

#### Prod url
[https://nav-enonicxp-dataquery.intern.nav.no/query](https://nav-enonicxp-dataquery.intern.nav.no/data)

## Parametre

branch er påkrevd, resten er optional

| Parameter          | Gyldige verdier
| ------------------ | -----------------------------------------------------
| branch             | published, unpublished, all
| query              | NoQL query string ([se dokumentasjon](https://developer.enonic.com/docs/xp/stable/storage/noql#query))
| types              | array av content-typer queryet skal kjøres mot (overstyrer default-verdier [1])
| fields             | array av felter som skal returneres for hvert treff (hvis tom returneres alle felter)

[1] Default content-typer som hentes ut:
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

Returnerer publisert innhold med innholdstype main-article:
```
https://nav-enonicxp-dataquery.intern.nav.no/query?branch=published&type=["no.nav.navno:main-article"]
```

## Response

```
{
    branch,
    query,
    types,
    fields,
    numHits,
    hits        // Array med treff
}
```
