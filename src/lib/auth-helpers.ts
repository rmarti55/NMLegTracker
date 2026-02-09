import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getAuthSession() {
  return getServerSession(authOptions);
}
