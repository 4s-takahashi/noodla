/**
 * transport/index.ts — デフォルトトランスポートの export
 *
 * アプリ全体で使用するトランスポートの singleton インスタンスを提供する。
 * WebRTC 移行時はここを WsTransport → WebRtcTransport に差し替える。
 */

export type { ITransport, TransportConnectionState, TransportConnectOptions } from './ITransport';
export { WsTransport } from './WsTransport';

import { WsTransport } from './WsTransport';
import type { ITransport } from './ITransport';

/**
 * アプリ共通のトランスポート singleton。
 * ws-store.ts から参照される。
 */
export const transport: ITransport = new WsTransport();
