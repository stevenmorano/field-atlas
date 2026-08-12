import { PublicProfile } from "@/features/community/public-profile";

export default async function ProfilePage({ params }: Readonly<{ params: Promise<{ username: string }> }>) {
  const { username } = await params;
  return <PublicProfile username={username} />;
}
