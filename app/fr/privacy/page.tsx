import type { Metadata } from "next";
import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { platformName, platformPublicUrl } from "@/lib/platform";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Studiofront collecte et utilise les données personnelles (PIPEDA et Loi 25 du Québec).",
  alternates: {
    canonical: "/fr/privacy",
    languages: { en: "/privacy", fr: "/fr/privacy" },
  },
};

export default function PrivacyPageFr() {
  const name = platformName();
  const site = platformPublicUrl().replace(/\/$/, "");

  return (
    <>
      <PlatformHeader solid />
      <main id="main" lang="fr">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Juridique</p>
            <h1>Politique de confidentialité</h1>
            <p className="section-copy">Dernière mise à jour : 19 septembre 2026</p>
            <p className="section-copy">
              <Link className="text-link" href="/privacy">
                English
              </Link>
            </p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner prose">
            <p>
              La présente politique décrit comment {name} ({site}) collecte,
              utilise et communique des renseignements personnels dans le cadre
              de son logiciel pour photographes immobiliers, conformément à la
              LPRPDE fédérale et à la Loi sur la protection des renseignements
              personnels dans le secteur privé du Québec (RLRQ c. P-39.1, « Loi
              25 »).
            </p>

            <h2>Responsable de la protection des renseignements personnels</h2>
            <p>
              Le responsable de la protection des renseignements personnels de{" "}
              {name} est le responsable de la confidentialité. Titre :
              Responsable de la confidentialité. Coordonnées :{" "}
              <a href="mailto:privacy@studiofront.ca">privacy@studiofront.ca</a>{" "}
              (ou{" "}
              <a href="mailto:hello@studiofront.ca">hello@studiofront.ca</a>).
              Vous pouvez le contacter pour exercer vos droits d’accès et de
              rectification.
            </p>

            <h2>Personnes visées</h2>
            <p>
              Photographes et membres d’équipe qui créent un compte {name};
              courtiers et vendeurs qui réservent une séance ou ouvrent un lien
              de galerie ou de fiche propriété.
            </p>

            <h2>Renseignements recueillis</h2>
            <ul>
              <li>
                <strong>Compte :</strong> nom, courriel, hachage de mot de
                passe, nom du studio et réglages.
              </li>
              <li>
                <strong>Réservation et livraison :</strong> détails de la
                propriété, coordonnées du courtier, notes d’accès, horaires,
                consultations et téléchargements de galerie (événements
                premiers partis).
              </li>
              <li>
                <strong>Médias :</strong> photos et fichiers téléversés.
              </li>
              <li>
                <strong>Facturation :</strong> identifiants Stripe (pas de
                numéro de carte complet).
              </li>
              <li>
                <strong>Google Agenda (facultatif) :</strong> jeton OAuth,
                courriel Google et données d’événements nécessaires.
              </li>
              <li>
                <strong>Analytique marketing (sans témoins) :</strong> Cloudflare
                Web Analytics sur le site marketing uniquement — sans cookies,
                hors sites studio et liens de galerie.
              </li>
              <li>
                <strong>Témoins de session :</strong> nécessaires à la
                connexion; non utilisés pour le profilage.
              </li>
            </ul>

            <h2>Utilisation</h2>
            <p>
              Nous utilisons ces renseignements uniquement pour exploiter{" "}
              {name} : comptes, réservations, galeries, abonnements et
              paiements Stripe, synchronisation Google Agenda si activée. Nous
              ne vendons pas de renseignements personnels.
            </p>

            <h2>Technologies d’identification, de localisation ou de profilage</h2>
            <p>
              Selon la Loi 25, ces fonctions doivent être désactivées par
              défaut. {name} n’offre actuellement pas de traceurs publicitaires
              ni d’outils de profilage. S’ils sont ajoutés plus tard, ils
              resteront désactivés jusqu’à un consentement explicite.
            </p>

            <h2>Communication hors Québec</h2>
            <p>
              Des fournisseurs situés hors Québec (et hors Canada) peuvent
              traiter des renseignements : Stripe, Resend, Cloudflare, Neon,
              Google. Une évaluation des facteurs relatifs à la vie privée
              (EFVP) documente ces transferts.
            </p>

            <h2>Fournisseurs</h2>
            <ul>
              <li>Paiements : Stripe</li>
              <li>Courriel transactionnel : Resend</li>
              <li>Hébergement et médias : Cloudflare Workers et R2</li>
              <li>Analytique marketing : Cloudflare Web Analytics</li>
              <li>Base de données : Neon Postgres</li>
              <li>Agenda (facultatif) : Google</li>
            </ul>

            <h2>Conservation</h2>
            <p>
              Les données de compte restent jusqu’à suppression du studio ou
              demande de retrait. Les jetons Google sont conservés seulement
              tant que la connexion est active.
            </p>

            <h2>Vos choix</h2>
            <p>
              Écrivez à{" "}
              <a href="mailto:privacy@studiofront.ca">privacy@studiofront.ca</a>{" "}
              pour accéder, corriger ou supprimer des données. Les plaintes
              relatives à la Loi 25 peuvent aussi être adressées à la Commission
              d’accès à l’information du Québec.
            </p>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
