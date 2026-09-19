import type { Metadata } from "next";
import {
  generateListingMetadata,
  ListingPublicPage,
} from "@/components/listing-public-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { slug: string };
type Search = { brand?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return generateListingMetadata(slug);
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <ListingPublicPage slug={slug} brandOff={query.brand === "off"} locale="en" />
  );
}
