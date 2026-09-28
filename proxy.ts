import { NextResponse, type NextRequest } from "next/server";
import { isAllowedHost } from "@/lib/auth/host";

export function proxy(request: NextRequest) {
  if (!isAllowedHost(request.headers.get("host"))) {
    return new NextResponse("This app only runs on this computer. Open http://localhost:3000.", {
      status: 403,
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
