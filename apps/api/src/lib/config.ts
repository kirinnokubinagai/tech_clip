import type { Bindings } from "../types";

/**
 * RunPod エンドポイント ID を環境に応じて返す
 *
 * @param env - Cloudflare Workers バインディング
 * @returns RunPod エンドポイント ID
 */
export function getRunPodEndpointId(env: Bindings): string {
  if (env.ENVIRONMENT === "development" && env.RUNPOD_LOCAL_ENDPOINT_ID) {
    return env.RUNPOD_LOCAL_ENDPOINT_ID;
  }

  return env.RUNPOD_ENDPOINT_ID;
}
