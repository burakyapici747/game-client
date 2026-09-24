// ─────────────────────────────────────────────────────────────────────────────
// KATILIM REDDİ — sunucunun JoinRejected karesini kullanıcı metnine çevirir.
//
// Sunucu katılımı iki sebeple reddeder ve ardından bağlantıyı KAPATIR
// (bkz. newproto/server/join-rejected.proto):
//   SKIN_NOT_SELECTED      SOCIAL giriş ama LootLocker deposunda takılı skin yok.
//   SERVER_API_UNAVAILABLE Oyun sunucusu proxy'ye (seanakes-io-server-api)
//                          ulaşamadı / 3 sn içinde yanıt alamadı.
//
// Karar KODA dayanır; sunucunun gönderdiği `detail` yalnızca yedek metindir.
// protobufjs enum alanlarını SAYI olarak çözer; eşleme server.JoinErrorCode
// üzerinden yapılır ki sunucu numaraları değiştirse bile burası bozulmasın.
// ─────────────────────────────────────────────────────────────────────────────
import { server } from './bundle.js';

export const JoinErrorCode = server.JoinErrorCode;

/** JoinRejected mesajından oyuncuya gösterilecek metin. */
export function describeJoinRejection(rejection) {
    const code = Number(rejection?.code ?? JoinErrorCode.JOIN_ERROR_UNSPECIFIED);
    switch (code) {
        case JoinErrorCode.SKIN_NOT_SELECTED:
            return 'No skin equipped.\nEquip a skin from the side panel and try again.';
        case JoinErrorCode.SERVER_API_UNAVAILABLE:
            return 'Account service is unavailable.\nPlease try again in a moment.';
        default:
            return rejection?.detail || 'The server rejected the join request.';
    }
}
