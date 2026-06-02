# Ghana Context, Copy & Accessibility

## Currency
- Ghana Cedis, code **GHS**. Display as `GHS 4,820.00` (thousands separators, 2 decimals). Internally store **pesewas** (integer, GHS×100).

## Mobile money networks
- **MTN**, **Telecel** (formerly Vodafone), **AirtelTigo (AT)**. Phone format `+233 XX XXX XXXX`; users enter the local 10-digit form (`0XXXXXXXXX`).
- Channel codes differ for collection vs disbursement — see `moolre-integration`.

## USSD
- ~55–60% of MoMo transactions run on USSD (no smartphone/internet). Every core action must have a USSD path.
- Placeholder codes used in UI: onboarding `*714#`, medical contribution `*713*<id>#`. Moolre USSD: `*203#`. Replace placeholders with real codes once Moolre confirms.

## Identity / KYC
- **Ghana Card**-verified MoMo numbers are the identity anchor. Onboarding links to the Ghana Card-verified number.

## Sample content (use real Ghanaian names/places, never lorem ipsum)
- Names: Ama Asante, Kofi Boateng, Akosua Frimpong, Kwame Mensah, Esi Owusu, Yaw Amponsah, Abena Owusu.
- Places: Kumasi (Ashanti), Accra (Greater Accra), Tema, Cape Coast, Takoradi; Korle Bu Teaching Hospital.
- Groups: "Kumasi Traders", "Accra Women Entrepreneurs".

## Copy & tone
- Warm, plain, trustworthy — calm, not loud fintech. Greeting: "Akwaaba, Ama".
- Write for users who may not be highly tech-literate: short sentences, concrete amounts, no jargon.
- Medical/emergency copy is **hopeful, never desperate**.
- Always reinforce trust: "CirclePay never holds your savings", "Secured by Moolre", "funds go straight to the verified hospital".

## Accessibility
- Semantic HTML, keyboard-navigable, visible focus states, 4.5:1 contrast minimum, large tap targets (≈48px).
- Responsive: mobile (~390px) single column + bottom tab bar; desktop sidebar + centered content.

## Brand
- Logo: a circle with a centered dot in brand green next to the wordmark "CirclePay".
- Brand green `#1D9E75`; warm paper background `#F5F3ED`; danger `#DC2626`; amber `#F59E0B`. White sidebar with green active state (current design).
