import type { Metadata } from "next";
import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName, platformPublicUrl } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description:
    "Conditions d’utilisation de Studiofront : comptes, abonnements, licences médias, MLS et limites de responsabilité.",
  alternates: {
    canonical: "/fr/terms",
    languages: { en: "/terms", fr: "/fr/terms" },
  },
};

export default function TermsPageFr() {
  const name = platformName();
  const site = platformPublicUrl().replace(/\/$/, "");

  return (
    <>
      <PlatformHeader solid />
      <main id="main" lang="fr">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Juridique</p>
            <h1>Conditions d’utilisation</h1>
            <p className="section-copy">Dernière mise à jour : 19 septembre 2026</p>
            <p className="section-copy">
              <Link className="text-link" href="/terms">
                English
              </Link>
            </p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              {name} ({site}) est un logiciel pour photographes immobiliers. En
              créant un compte ou en utilisant le service, vous acceptez ces
              conditions. Questions :{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a>.
              Ce texte est fourni à titre informatif et ne remplace pas un avis
              juridique.
            </p>

            <h2>Comptes et studios</h2>
            <p>
              Vous devez fournir des informations exactes et protéger vos
              identifiants. Vous êtes responsable du contenu, des réservations,
              des membres de l’équipe et des médias de votre studio. Les
              courtiers accèdent aux galeries par lien signé, pas par un compte{" "}
              {name}.
            </p>

            <h2>Abonnements</h2>
            <p>
              Les forfaits payants sont facturés mensuellement en USD via
              Stripe. Les quotas d’inscriptions et de sièges s’appliquent par
              année civile. Les nouveaux studios démarrent avec un essai de 14
              jours sauf indication contraire. Vous pouvez annuler dans les
              réglages de facturation; l’accès se poursuit jusqu’à la fin de la
              période payée.
            </p>

            <h2>Usage acceptable</h2>
            <p>
              N’envoyez pas de logiciels malveillants, de médias contrefaits ou
              de contenu pour lequel vous n’avez pas les droits. Ne sondez pas
              les données d’autres studios. Nous pouvons révoquer des galeries
              et suspendre des studios en cas d’abus.
            </p>

            <h2>Google Agenda</h2>
            <p>
              La connexion à Google Agenda est facultative. Si vous la
              connectez, vous autorisez {name} à créer et mettre à jour des
              événements de tournage et, le cas échéant, à lire d’autres
              événements comme périodes occupées. Vous pouvez déconnecter à
              tout moment.
            </p>

            <h2>Droit d’auteur</h2>
            <p>
              Les photographes conservent le droit d’auteur sur les médias
              qu’ils téléversent. La plateforme ne revendique pas la propriété
              des médias du studio.
            </p>

            <h2>Licence de marketing limitée</h2>
            <p>
              Sauf droits plus larges accordés par écrit par le studio, la
              licence par défaut du courtier est une licence de marketing
              limitée : utilisation des photos uniquement pour commercialiser
              l’inscription active et les services du courtier liés à cette
              propriété. Ce n’est pas un droit de redistribution MLS perpétuel,
              ni une autorisation de revente, de transfert ou de réutilisation
              après l’expiration ou le changement de courtier.
            </p>

            <h2>MLS et indemnisation</h2>
            <p>
              Si un courtier dépose des médias obtenus via {name} dans un MLS
              ou un système exigeant des droits plus larges que la licence de
              marketing limitée, il certifie avoir obtenu tous les droits
              nécessaires auprès du photographe et indemnisé {name} ainsi que
              le studio.
            </p>

            <h2>Liens de galerie</h2>
            <p>
              Les URL de galerie sont des identifiants secrets destinés au
              courtier qui a réservé ou payé. Les liens expirent (généralement
              14 jours). {name} n’est pas responsable d’une utilisation
              abusive après partage du lien.
            </p>

            <h2>Représentation fidèle, retouches et IA</h2>
            <p>
              Les outils de la plateforme servent à une livraison esthétique
              légitime. Les utilisateurs assument toute responsabilité
              réglementaire pour une représentation trompeuse de la propriété.
              {name} ne garantit pas la conformité MLS ou réglementaire des
              images modifiées.
            </p>

            <h2>Limitation de responsabilité</h2>
            <p>
              Le service est fourni tel quel. Dans la mesure permise par la
              loi, {name} n’est pas responsable des commissions perdues, des
              visites manquées ou d’autres interruptions d’affaires liées à
              une panne, à l’expiration d’un lien ou à un retard de livraison.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
