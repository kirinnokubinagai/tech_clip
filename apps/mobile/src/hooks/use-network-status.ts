import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/** ネットワーク状態 */
type NetworkStatus = {
  isOnline: boolean;
  isOffline: boolean;
};

/** 初期ネットワーク状態（楽観的にオンライン扱い） */
const INITIAL_STATUS: NetworkStatus = {
  isOnline: true,
  isOffline: false,
};

/**
 * NetInfoStateからNetworkStatusに変換する
 *
 * @param state - NetInfoの接続状態
 * @returns ネットワーク状態
 */
function toNetworkStatus(state: NetInfoState): NetworkStatus {
  const isOnline = state.isConnected === true;
  return { isOnline, isOffline: !isOnline };
}

/**
 * ネットワーク接続状態を監視するカスタムフック
 *
 * @returns isOnline / isOffline フラグ
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(INITIAL_STATUS);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus(toNetworkStatus(state));
    });

    return unsubscribe;
  }, []);

  return status;
}
