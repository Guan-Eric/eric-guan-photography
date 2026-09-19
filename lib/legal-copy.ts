/** Versioned EN/FR legal copy kept in lockstep (Charter s. 55). */

export const LEGAL_COPY_VERSION = "2026-09-19";

export const marketingLicense = {
  en: {
    title: "Limited Marketing License",
    summary:
      "I accept the Limited Marketing License: photos may be used only to market this active listing and my services as the booking agent. I will not resell, transfer, or reuse the files after the listing expires or a new listing agent is appointed. I am responsible for MLS license terms.",
    checkbox: "I have read and accept the Limited Marketing License",
    continueEn: "Continue in English",
    accept: "Accept & enable downloads",
    accepted: "License accepted — downloads enabled.",
    prompt: "Accept the Limited Marketing License to download MLS and full-resolution files.",
  },
  fr: {
    title: "Licence de marketing limitée",
    summary:
      "J’accepte la licence de marketing limitée : les photos ne peuvent servir qu’à commercialiser cette inscription active et mes services à titre de courtier ayant réservé le service. Je ne revendrai, ne transférerai ni ne réutiliserai les fichiers après l’expiration de l’inscription ou le changement de courtier. Je suis responsable des conditions de licence MLS.",
    checkbox: "J’ai lu et j’accepte la licence de marketing limitée",
    continueEn: "Continuer en anglais",
    accept: "Accepter et activer les téléchargements",
    accepted: "Licence acceptée — téléchargements activés.",
    prompt:
      "Acceptez la licence de marketing limitée pour télécharger les fichiers MLS et pleine résolution.",
  },
} as const;

export type LegalLang = "en" | "fr";
