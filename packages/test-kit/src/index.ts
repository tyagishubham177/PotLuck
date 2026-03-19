import { clientSnapshotSchema } from "@potluck/contracts";

export function createClientSnapshotFixture() {
  return clientSnapshotSchema.parse({
    appName: "PotLuck",
    appOrigin: "http://localhost:3000",
    serverOrigin: "http://localhost:3001",
    status: "foundation-ready"
  });
}
