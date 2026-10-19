// Text follows the device language: Turkish devices get Turkish, everyone
// else English. Rules and shared messages are written in English and
// translated on display, so each player reads their own language.
export const turkish = /^tr\b/i.test(globalThis.navigator?.language ?? "");

const COLORS = { red: "kırmızı", black: "siyah", blue: "mavi", yellow: "sarı" };

const TR = [
  [/^Not your turn$/, "Sıra sende değil"],
  [/^Draw a tile first$/, "Önce taş çek"],
  [/^Can't draw more tiles$/, "Daha fazla taş çekemezsin"],
  [/^Can't draw this tile$/, "Bu taşı çekemezsin"],
  [/^Can't move other players tiles$/, "Başkasının taşını oynatamazsın"],
  [/^Can't discard before drawing$/, "Taş çekmeden atamazsın"],
  [/^Invalid discard source$/, "Bu taş atılamaz"],
  [/^The round is over$/, "El bitti"],
  [/^Select tiles from your rack$/, "Istakandan taş seç"],
  [/^Keep a tile to discard$/, "Atmak için bir taş bırak"],
  [/^No laying down in the Elden round$/, "Elden elinde yere açılmaz"],
  [/^Open your hand first$/, "Önce elini aç"],
  [
    /^You can lay more from next turn$/,
    "Daha fazlasını sonraki turda açabilirsin",
  ],
  [
    /^No opening in the Elden round: finish from your hand$/,
    "Elden elinde açma yok: elinden bitir",
  ],
  [/^You've already opened$/, "Zaten açtın"],
  [/^Open with exactly: (.+)$/, "Tam olarak şununla aç: $1"],
  [/^That's not a küt or a seri$/, "Bu küt ya da seri değil"],
  [/^That tile doesn't fit there$/, "Bu taş oraya işlemez"],
  [
    /^No okey there that tile can replace$/,
    "Bu taşın yerine geçeceği okey yok",
  ],
  [
    /^Before opening, okeys can be taken from round (\d+)$/,
    "Açmadan okey ancak $1. elden itibaren alınır",
  ],
  [
    /^You took an okey: open your hand, or put the okey back$/,
    "Okeyi aldın: elini aç ya da okeyi geri koy",
  ],
  [
    /^Complete all four of the küt to take its okey$/,
    "Okeyi almak için kütün dördünü de tamamla",
  ],
  [/^That tile was caught$/, "Bu taş yakalandı"],
  [/^Nothing to take right now$/, "Şu an alınacak taş yok"],
  [/^You already drew this turn$/, "Bu tur zaten çektin"],
  [/^That's your own tile$/, "Bu senin taşın"],
  [/^You can take (\d+) a round$/, "Bir elde en fazla $1 taş alabilirsin"],
  [/^No tiles left for the extra draw$/, "Ekstra çekmek için taş kalmadı"],
  [
    /^Give the others (\d+)s to take the discard$/,
    "Diğerlerine taşı almaları için $1 sn ver",
  ],
  [/^Nothing to catch$/, "Yakalanacak taş yok"],
  [/^Already caught$/, "Zaten yakalandı"],
  [
    /^That tile doesn't fit a meld on the table$/,
    "Bu taş yerdekilere işlemiyor",
  ],
  [/^(.+) caught (.+)'s tile: \+(\d+)$/, "$1 yakaladı: $2 +$3"],
  [
    /^Finish by laying down your tiles and discarding the last one$/,
    "Taşlarını yere açıp sonuncuyu atarak bitir",
  ],
  [/^(.+) finished round (\d+)$/, "$1 $2. eli bitirdi"],
  [/^Round (\d+): no tiles left$/, "$1. el: taş kalmadı"],
  [/^(.+) wins with (-?\d+)$/, "$1 kazandı: $2"],
  [/^(.+) wins!$/, "$1 kazandı!"],
  [/^(.+) left$/, "$1 ayrıldı"],
  [
    /^not enough players to start the game$/,
    "Başlamak için yeterli oyuncu yok",
  ],
  [/^Invalid sequence (.+)$/, "Geçersiz dizi $1"],
  [/^Unfinished sequence (.+)$/, "Yarım dizi $1"],
  [/^Duplicate tile detected$/, "Aynı taştan fazla var"],
  [
    /^(.+) wants? (.+)'s (red|black|blue|yellow) (\d+)$/,
    (_, who, from, color, rank) =>
      `${who} istiyor: ${from} · ${COLORS[color]} ${rank}`,
  ],
  [/^(.+) wants? (.+)'s fake okey$/, "$1 istiyor: $2 · sahte okey"],
  // labels
  [/^Start Okey$/, "Okey başlat"],
  [/^Start Americano$/, "Americano başlat"],
  [/^Reset Game$/, "Oyunu sıfırla"],
  [/^New Game$/, "Yeni oyun"],
  [/^Open$/, "Aç"],
  [/^Lay down$/, "Per aç"],
  [/^Catch discard$/, "Yakala"],
  [/^Next Round$/, "Sonraki el"],
  [/^Scores$/, "Puanlar"],
  [/^Total$/, "Toplam"],
  [/^Sit$/, "Otur"],
  [/^Stand$/, "Kalk"],
  [/^Free seat: (.+)$/, "Yeri boşalt: $1"],
  [/^Player (\d+)$/, "Oyuncu $1"],
  [/^opened$/, "açtı"],
  [/^drew$/, "çekti"],
  [/^Table menu$/, "Masa menüsü"],
  [/^Sure\? Tap again$/, "Emin misin? Tekrar dokun"],
  [/^Saved games$/, "Kayıtlı oyunlar"],
  [/^Set up Americano$/, "Americano ayarla"],
  [/^On this device$/, "Bu cihazda"],
  [
    /^No saved games on this device yet\.$/,
    "Bu cihazda henüz kayıtlı oyun yok.",
  ],
  [/^this room$/, "bu oda"],
  [/^From another device$/, "Başka bir cihazdan"],
  [/^Copy this game's code$/, "Bu oyunun kodunu kopyala"],
  [/^Copied$/, "Kopyalandı"],
  [/^Couldn't copy$/, "Kopyalanamadı"],
  [/^Download$/, "İndir"],
  [/^Paste a save code$/, "Kayıt kodunu yapıştır"],
  [/^That's not a save code$/, "Bu bir kayıt kodu değil"],
  [/^Load this game$/, "Bu oyunu yükle"],
  [/^nobody$/, "kimse"],
  [/^Close$/, "Kapat"],
  [/^Round$/, "El"],
  [/^starts$/, "başlar"],
  [/^Deal from here$/, "Buradan dağıt"],
  [/^Drag here to open$/, "Açmak için buraya sürükle"],
  [/^Drag here to lay down$/, "İşlemek için buraya sürükle"],
  [/^Catch$/, "Yakala"],
  [/^(.+)'s turn$/, "sıra: $1"],
  [/^Round (\d+)\/(\d+)$/, "El $1/$2"],
  [/^Turn your phone sideways to play$/, "Oynamak için telefonu yan çevir"],
  [/^Fullscreen$/, "Tam ekran"],
  [/^Menu$/, "Menü"],
  [/^Share Link$/, "Bağlantıyı paylaş"],
  [/^Copied!$/, "Kopyalandı!"],
  [/^Connected:$/, "Bağlı:"],
  [/^Sound Effects from$/, "Ses efektleri:"],
  [/^User:$/, "Kullanıcı:"],
  [/^Go$/, "Gir"],
];

// English keeps the game's own Turkish words out: küt is a set, seri a run
const EN = [
  [/(\d)'l[üi] küt/g, "set of $1"],
  [/(\d)'l[üi] seri/g, "run of $1"],
  [/\bküt\b/g, "set"],
  [/\bseri\b/g, "run"],
];

export function t(text, tr = turkish) {
  if (typeof text !== "string") return text;
  if (!tr) return EN.reduce((s, [re, to]) => s.replace(re, to), text);
  const hit = TR.find(([re]) => re.test(text));
  return hit ? text.replace(hit[0], hit[1]) : text;
}
