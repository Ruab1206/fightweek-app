// Catalogue Feature Spec — living requirements for catalogue modals & fields
export const CATALOGUE_SPEC = `# Catalogue Feature Spec

> Levende specifikation for Træningskatalog-modalerne. Vedligeholdes løbende efterhånden som nye felter og features tilføjes.

---

## Modaler

| Modal | Formål | Adgang |
|-------|--------|--------|
| **Detail-modal** (read-only) | Vis alle oplysninger om et hold | Alle besøgende |
| **Rediger-modal** (CRUD) | Opret / rediger / slet hold | Admin & coach |

---

## Feltoversigt

| # | Felt | Type | Edit-modal | Detail-modal | Beskrivelse |
|---|------|------|:----------:|:------------:|-------------|
| 1 | **title** | text | ✅ | ✅ | Holdnavn, f.eks. "Thaiboksning Elite" |
| 2 | **discipline** | select | ✅ | ✅ | Overordnet disciplin (MMA, BJJ, Boxing, Muay Thai, Wrestling, S&C, Andet) |
| 3 | **subDiscipline** | text | ✅ | ✅ | Teknisk underfokus, f.eks. "Thai clinch", "Wall wrestling" |
| 4 | **level** | select | ✅ | ✅ | Niveau (Beginner, Advanced, Kamphold, Elite, Pro, Alle niveauer) |
| 5 | **ageGroup** | text | ✅ | ✅ | Aldersgruppe, f.eks. "6-12 år", "13-17 år" — adskilt fra niveau |
| 6 | **gym** | select | ✅ | ✅ | Klub (Fightworld, BurnellMMA, Rumble Sports, Arte Suave, Hillerød MMA) |
| 7 | **location** | text | ✅ | ✅ | Lokation / sal, f.eks. "Sal 1", "Kælderen" |
| 8 | **address** | text | ✅ | ✅ | Fysisk adresse — bruges til Google Calendar location + link til Google Maps i detail-modal |
| — | **distance** | number | — | ⬜ | Afstand fra brugerens registrerede adresse. Later. |
| 9 | **schedules** | multi-row | ✅ | ✅ | Ugentlige tider: dag + start + slut. Flere rækker muligt. |
| 10 | **instructor** | text | ✅ | ✅ | Instruktørnavn |
| 11 | **description** | textarea | ✅ | ✅ | Fritekst — forudsætninger, fokus, noter |
| 12 | **showRatings** | toggle | ⬜ | ⬜ | Vis gennemsnitlige ratings fra fighters (intensitet/relevans). Later. |
| — | **intensityLevel** | computed | ⬜ | ⬜ | Gennemsnit og varians af intensitets-ratings. Later. |
| — | **recommend** | action | ⬜ | ⬜ | Anbefal holdet til en anden bruger + se hvem der allerede har anbefalet det. Later. |
| 13 | **source** | auto | ✅ | ✅ | Oprindelse: \`holdoversigt-import\` eller \`manual\`. Vises som klikbart link i detail-modal. |
| 14 | **createdAt** | auto | ✅ | ✅ | Oprettelsestidspunkt (ISO 8601). Sættes automatisk. |
| 15 | **updatedAt** | auto | ✅ | ✅ | Senest redigeret (ISO 8601). Sættes automatisk. |
| 16 | **createdBy** | auto | ✅ | — | Oprettet af (email). Sættes automatisk ved oprettelse. |

> ✅ = implementeret &nbsp; ⬜ = planlagt / ikke implementeret endnu &nbsp; — = ikke relevant for denne modal

---

## Planlagte tilføjelser (ikke i datamodel endnu)

| # | Felt | Type | Edit | Detail | Beskrivelse |
|---|------|------|:----:|:------:|-------------|
| — | **tags** | multi-select | ⬜ | ⬜ | Labels som "sparring", "teknik", "kondition" — til filtrering |
| — | **maxParticipants** | number | ⬜ | ⬜ | Max antal deltagere per session |
| — | **contactInfo** | text | ⬜ | ⬜ | Kontakt-email eller tlf for holdet |
| — | **rating (avg)** | computed | — | ⬜ | Aggregeret gennemsnit fra fighters, når showRatings = true |
| — | **linkedFighters** | list | — | ⬜ | Kæmpere der har dette hold på deres ugeplan |

---

## Designprincipper

- **Detail-modalen** viser ALT der er udfyldt — den er "read more" for alle brugere
- **Edit-modalen** viser de felter admin reelt kan redigere + metadata-sektion (read-only) for eksisterende hold
- Begge modaler følger SessionModal-designsystemet (overlay, kort, header/body/footer)
- Felter med ⬜ tilføjes løbende — tabellen opdateres først, derefter implementering
- Klik på kort åbner detail-modal; admin ser "Rediger"-knap i detail-modal
`;
