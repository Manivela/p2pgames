// Text follows the device language: Turkish devices get Turkish, everyone
// else English. Rules and shared messages are written in English and
// translated on display, so each player reads their own language. TR takes
// the first pattern that matches: a specific one sits above any catch-all it
// would hit ("No tiles left" above "(.+) left"). i18n.test.js checks the
// `return "…"` messages of the rules files it lists: a new one joins it.
export const turkish = /^tr\b/i.test(globalThis.navigator?.language ?? "");

const COLORS = { red: "kırmızı", black: "siyah", blue: "mavi", yellow: "sarı" };

// a whole sentence as it's written, its . ( ) ? as themselves
const exact = (text) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

const TR = [
  // How to play (HowToPlay.jsx), above any pattern that might take a line
  ...[
    ["How to play", "Nasıl oynanır"],
    ["Tic-tac-toe", "XOX"],
    ["Super tic-tac-toe", "Süper XOX"],
    ["Backgammon", "Tavla"],
    ["Checkers", "Amerikan daması"],
    ["Dama", "Dama"],
    ["Jump on with the same piece", "Aynı taşla yemeye devam et"],
    ["Take the most pieces you can", "Yiyebileceğin en çok taşı ye"],
    ["A jump has to be taken", "Taş yemek zorunlu"],
    [
      "Take turns marking a square, X first; the other starts the next game.",
      "Sırayla bir kareye işaret koyun, önce X; sonraki oyuna öteki başlar.",
    ],
    [
      "Three of yours in a row, across, down or diagonally, wins the game and a point.",
      "Yan yana, alt alta ya da çapraz üç işaretin oyunu ve bir puanı kazandırır.",
    ],
    [
      "Nine small boards in one. Where you mark in a small board sends the other to that board of the nine.",
      "Dokuz küçük tahta bir arada. Küçük tahtada nereye işaret koyarsan öteki, dokuzun o yerdeki tahtasına oynar.",
    ],
    [
      "Three in a row takes a small board; three boards in a row win the game and a point. Sent to a board that's decided, play anywhere.",
      "Küçük tahtada üçlü yapan o tahtayı alır; yan yana üç tahta oyunu ve bir puanı kazandırır. Gönderildiğin tahta bitmişse istediğin yere oyna.",
    ],
    [
      "Race your 15 checkers round to your home, the last six points, then bear them off. The first to bear off all 15 wins.",
      "15 pulunu evine, son altı haneye getir, sonra topla. 15 pulunu ilk toplayan kazanır.",
    ],
    [
      "Tap the dice to roll. Each die moves a checker that many points; a double moves four times. Every die that can be played must be.",
      "Zar atmak için zarlara dokun. Her zar bir pulu o kadar hane götürür; çift gelirse dört kez oynanır. Oynanabilen her zar oynanmalı.",
    ],
    [
      "Two or more of the other's checkers close a point. A lone one is a blot: land on it to hit it, and it goes to the bar.",
      "Ötekinin iki ya da daha çok pulu haneyi kapatır. Tek pul açıktır: üstüne gelirsen vurursun, pul bara gider.",
    ],
    [
      "A checker on the bar comes back in on the other's home board before anything else moves.",
      "Bardaki pul, başka bir pul oynamadan önce ötekinin evinden içeri girer.",
    ],
    [
      "A win is a point; a mars, the other having borne none off, is two.",
      "Kazanmak bir puan; mars, öteki hiç pul toplamamışken, iki puan.",
    ],
    [
      "Men step diagonally forward on the dark squares; black moves first.",
      "Taşlar koyu karelerde çapraz ileri gider; önce siyah oynar.",
    ],
    [
      "Jump a piece next to yours, onto the empty square past it, to take it, and jump on while you can. A jump has to be taken.",
      "Yanındaki taşın üstünden arkasındaki boş kareye atlayarak onu ye, yiyebildikçe atlamaya devam et. Yemek zorunludur.",
    ],
    [
      "A man reaching the far row becomes a king, stepping and jumping both ways.",
      "Son sıraya varan taş dama olur, iki yöne de gider ve yer.",
    ],
    [
      "Take or block all the other's pieces to win. 40 moves each with no jump and no man going forward is a draw.",
      "Ötekinin bütün taşlarını ye ya da kıpırdayamaz bırak. Kimse taş yemeden ve ileri taş sürmeden geçen kişi başı 40 hamle berabere biter.",
    ],
    [
      "Men step straight forward or sideways, never back; white moves first.",
      "Taşlar düz ileri ya da yana gider, geri gitmez; önce beyaz oynar.",
    ],
    [
      "Jump a piece next to yours to take it, and jump on while you can. A jump has to be taken, and of them the one taking the most.",
      "Yanındaki taşın üstünden atlayarak onu ye, yiyebildikçe devam et. Yemek zorunludur, en çok taş yiyen yol seçilir.",
    ],
    [
      "A man reaching the far row becomes a king: it goes any distance straight, and jumps a piece from afar, landing anywhere past it.",
      "Son sıraya varan taş dama olur: düz istediği kadar gider, uzaktaki taşın üstünden atlayıp arkasında istediği boş kareye konar.",
    ],
    [
      "Take or block all the other's pieces to win. A king against a lone man is a draw, as are 40 moves each with no jump and no man going forward.",
      "Ötekinin bütün taşlarını ye ya da kıpırdayamaz bırak. Tek taşa karşı dama berabere biter; kimse taş yemeden ve ileri taş sürmeden geçen kişi başı 40 hamle de öyle.",
    ],
    [
      "Take turns putting a stone on an empty point, black first. Tap your bowl to pass.",
      "Sırayla boş bir noktaya taş koyun, önce siyah. Pas geçmek için kâsene dokun.",
    ],
    [
      "Stones with no empty point beside them, alone or joined in a line, are captured.",
      "Yanında boş nokta kalmayan taşlar, tek başına ya da birbirine bağlı, esir alınır.",
    ],
    [
      "No stone may go where it would have none, unless it captures; nor may a capture undo the last one at once (ko).",
      "Esir almıyorsa taş nefessiz kalacağı yere konmaz; bir esir alma da bir öncekini hemen geri alamaz (ko).",
    ],
    [
      "Two passes in a row end the game. Each side counts its stones on the board and the empty points only its stones surround; white gets 7.5 more for going second.",
      "Art arda iki pas oyunu bitirir. Her taraf tahtadaki taşlarını ve yalnız kendi taşlarının çevirdiği boş noktaları sayar; beyaz ikinci oynadığı için 7,5 fazla alır.",
    ],
    [
      "Every stone left counts, so capture the other's dead stones before you pass. After a pass the board shows whose each empty point would be.",
      "Kalan her taş sayılır; pas geçmeden ötekinin ölü taşlarını esir al. Bir pastan sonra tahta, her boş noktanın kime sayılacağını gösterir.",
    ],
    [
      "The higher count wins the game and a point.",
      "Sayısı yüksek olan oyunu ve bir puanı kazanır.",
    ],
    [
      "2 to 4 players. 106 tiles: 1 to 13 in four colours, two of each, and two fake okeys.",
      "2 ile 4 oyuncu. 106 taş: dört renkte 1'den 13'e, her birinden iki tane, ve iki sahte okey.",
    ],
    [
      "The tile turned up at the deal is the indicator. The okey, its colour one higher, stands for any tile; a fake okey stands for the okey's own colour and number.",
      "Dağıtımda açılan taş göstergedir. Onun renginde bir büyüğü okeydir ve her taşın yerini tutar; sahte okey, okeyin kendi rengi ve sayısı yerine geçer.",
    ],
    [
      "A turn: draw from the middle, or take the tile the player before you threw; then throw one.",
      "Sıran gelince ortadan taş çek ya da senden önceki oyuncunun attığı taşı al; sonra bir taş at.",
    ],
    [
      "Sets: one number in different colours. Runs: one colour in a row. Three tiles or more each.",
      "Küt: farklı renklerde aynı sayı. Seri: aynı renkte sıralı sayılar. En az üçer taş.",
    ],
    [
      "Finish by laying your whole hand in sets and runs, or seven pairs, as you throw your last tile.",
      "Son taşını atarken bütün elini küt ve serilerle ya da yedi çiftle açarak bit.",
    ],
    [
      "The finisher scores −20, the others the numbers on their tiles (an okey 25). The lowest total wins.",
      "Biten −20 yazar, diğerleri taşlarının sayılarını (okey 25). En düşük toplam kazanır.",
    ],
    [
      "13 hands, each opened with the melds it names; the last is finished from the hand in one go, nothing laid before.",
      "13 el; her el söylediği perlerle açılır, sonuncusu önceden hiçbir şey açmadan tek seferde elden bitirilir.",
    ],
    [
      "Once open, lay more melds and add to anyone's; finish by throwing your last tile.",
      "Açtıktan sonra yeni perler aç, herkesin perine işle; son taşını atarak bit.",
    ],
    [
      "A discard can be claimed out of turn, with a tile from the middle as a penalty; a tile thrown that fits a meld on the table can be caught, and its thrower pays 20.",
      "Atılan taş sırası gelmeden istenebilir, ceza olarak ortadan bir taşla; yerdeki bir pere işleyen atılan taş yakalanabilir, atan 20 öder.",
    ],
    [
      "Finishing scores −20, not opening 100, the rest their tiles (an okey 25); the okey thrown last doubles them. The lowest total after 13 hands wins.",
      "Biten −20, açmayan 100, diğerleri taşlarını yazar (okey 25); son atılan okey bunları ikiye katlar. 13 elin sonunda en düşük toplam kazanır.",
    ],
    [
      "11 hands. Open with sets and runs worth 101 or more at face value, or with five pairs.",
      "11 el. Değeri 101 ya da daha fazla eden küt ve serilerle ya da beş çiftle aç.",
    ],
    [
      "Before you open, take a discard only to open with it that turn; once open, take them as you like, and lay and add to melds.",
      "Açmadan yandan taşı ancak onunla o tur açacaksan alabilirsin; açtıktan sonra istediğini al, per aç ve işle.",
    ],
    [
      "Finishing scores −101, not opening 202, the rest their tiles (an okey 101); pairs and the okey thrown last double the scores. The lowest total after 11 hands wins.",
      "Biten −101, açmayan 202, diğerleri taşlarını yazar (okey 101); çiftle bitmek ve son atılan okey puanları katlar. 11 elin sonunda en düşük toplam kazanır.",
    ],
  ].map(([en, tr]) => [exact(en), tr]),
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
  [
    /^No laying down this round: finish from your hand$/,
    "Elden elinde yere açılmaz",
  ],
  [/^Open your hand first$/, "Önce elini aç"],
  [/^Pick the pairs to open with$/, "Açacağın çiftleri seç"],
  [/^The okey's penalty is already written$/, "Okeyin cezası zaten yazıldı"],
  [
    /^You can lay more from next turn$/,
    "Daha fazlasını sonraki turda açabilirsin",
  ],
  [
    /^No opening this round: finish from your hand$/,
    "Elden elinde açma yok: elinden bitir",
  ],
  [/^You've already opened$/, "Zaten açtın"],
  [/^Open with exactly: (.+)$/, "Tam olarak şununla aç: $1"],
  [/^Open with (\d+)\+ or (\d+) pairs$/, "$1+ sayıyla ya da $2 çiftle aç"],
  [
    /^Use the tile you took from the discard, or put it back$/,
    "Yerden aldığın taşı işle ya da geri koy",
  ],
  [
    /^You opened with pairs: lay pairs, or add to sets and runs$/,
    "Çiftle açtın: çift aç ya da yerdekilere işle",
  ],
  [/^That's not a küt or a seri$/, "Bu küt ya da seri değil"],
  [/^That's not a pair, küt or seri$/, "Bu çift, küt ya da seri değil"],
  [/^That tile doesn't fit there$/, "Bu taş oraya işlemez"],
  [
    /^Only a tile you added this turn comes back$/,
    "Yalnızca bu tur işlediğin taş geri alınır",
  ],
  [/^Take back the tile past it first$/, "Önce ötesindeki taşı geri al"],
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
  [/^That's your partner's tile$/, "Bu eşinin taşı"],
  [/^Too late to catch it$/, "Yakalamak için geç: ortadan çekildi"],
  [/^Partners take four players$/, "Eşli oyun dört kişiyle oynanır"],
  [/^A round takes two players$/, "Bir el en az iki kişiyle oynanır"],
  [
    /^Up to (\d+) players with these rules$/,
    "Bu kurallarla en fazla $1 oyuncu",
  ],
  // the next game's settings (rulesets.js, GameSettings.jsx)
  [/^Give the rules a name$/, "Kurallara bir ad ver"],
  [/^2 to 8 players$/, "2 ile 8 arası oyuncu"],
  [/^1 to 4 sets of tiles$/, "1 ile 4 arası taş takımı"],
  [/^Not enough tiles for those hands$/, "Bu eller için taş yetmez"],
  [
    /^Not enough tiles left to deal you in$/,
    "Sana dağıtacak kadar taş kalmadı",
  ],
  [/^Fill in every number$/, "Her sayıyı doldur"],
  [/^Make the rack's rows longer$/, "Istaka sıralarını uzat"],
  [/^1 to 50 rounds$/, "1 ile 50 arası el"],
  [
    /^Round (\d+) asks for more than a hand holds$/,
    "$1. el, elin tutabileceğinden fazlasını istiyor",
  ],
  [/^That name is taken$/, "Bu ad alınmış"],
  [/^Saved on this device$/, "Bu cihaza kaydedildi"],
  // what each setting does (GameSettings.jsx)
  [
    /^How the round opens: with these melds, with sets and runs worth the points or with the pairs, or not at all, finished from the hand$/,
    "El nasıl açılır: bu perlerle, sayısı tutan seri ve kütlerle ya da çiftlerle; ya da hiç açılmaz, elden bitirilir",
  ],
  [
    /^The player whose turn it is can shuffle the discards into a new pile and play on, or end the round$/,
    "Sırası gelen, atılan taşları karıştırıp yeni deste yapabilir ve oyun sürer, ya da eli bitirebilir",
  ],
  [
    /^Four in two pairs across the table: a team scores both partners' totals, and the finisher's partner pays nothing for their hand$/,
    "Eşli: dört kişi, karşılıklı iki takım; takım iki eşin toplamını yazar, bitirenin eşi elindekini yazmaz",
  ],
  [
    /^The okey thrown last doubles everyone else's score; so does a win with pairs or in one go$/,
    "Okeyle bitirmek diğerlerinin puanını katlar; çiftle ya da tek seferde bitirmek de",
  ],
  [
    /^The finisher's score doubles too; off: finishing always scores the same$/,
    "Bitirenin puanı da katlanır; kapalıyken bitiren hep aynı puanı yazar",
  ],
  [
    /^Anyone may take the last discard out of turn, with an extra tile from the pile$/,
    "Herkes son atılan taşı sırası gelmeden alabilir, desteden bir taş daha alarak",
  ],
  [
    /^A discard taken before opening is opened with that turn, or goes back on its pile; once open, any can be taken$/,
    "Açmadan yandan alınan taşla o tur açılır, ya da taş geri bırakılır; açtıktan sonra istenen alınır",
  ],
  [
    /^Lay more melds and add to the table on the turn you open$/,
    "Açtığın turda başka per açabilir, yerdekilere işleyebilirsin",
  ],
  [
    /^A table okey goes to whoever puts down the tile it stands for$/,
    "Yerdeki okey, yerine geçtiği taşı koyana geçer",
  ],
  [
    /^A discard that fits a table meld can be caught only until the next player draws$/,
    "Yerdeki bir pere işleyen atılan taş, sıradaki oyuncu çekene dek yakalanabilir",
  ],
  [
    /^Seconds the others have to catch a discard before the next player can take it$/,
    "Atılan taşı yakalamak için diğerlerinin süresi; sıradaki oyuncu taşı ancak sonra alır (sn)",
  ],
  [
    /^A caught discard can still be taken by the next player$/,
    "Yakalanan taşı sıradaki oyuncu yine alabilir",
  ],
  [
    /^Once someone opens with pairs, everyone lays pairs$/,
    "Biri çift açınca herkes çift açar",
  ],
  [
    /^Opening with points takes more than the highest opening so far this hand$/,
    "Katlamalı: sayıyla açmak, bu elde o ana dek açılan en yüksek sayıdan fazlasını ister",
  ],
  [
    /^Laying all but one tile at once and finishing opens below the points too$/,
    "Tek taş hariç hepsini bir seferde açıp bitirmek, açış sayısının altında da açar",
  ],
  [
    /^A round that ends this way is scored as usual; off: it's dealt again, and only the okeys held score$/,
    "Böyle biten el her zamanki gibi yazılır; kapalıyken el yeniden dağıtılır, yalnız eldeki okeyler yazılır",
  ],
  [
    /^On a round that opens with pairs, a tap on a discard pile spreads its tiles out to look through$/,
    "Çiftle açılan elde, atılan taşlara dokununca hepsi açılır, bakılabilir",
  ],
  [/^Just for you$/, "Yalnız senin için"],
  [
    /^Slots in each row of your own rack; empty: the table's$/,
    "Kendi ıstakanın her sırasındaki yuva; boşsa masanınki",
  ],
  [
    /^Once someone has opened with pairs, a tap on a discard pile spreads its tiles out to look through$/,
    "Biri çifte gidince atılan taşlara dokununca hepsi açılır, herkes bakabilir",
  ],
  [
    /^Not opening scores the okeys held too, and doubles with the rest$/,
    "Açamayana elindeki okeyler de yazılır, katlamada o da katlanır",
  ],
  [
    /^A player who didn't open scores their hand like everyone else$/,
    "Açamayanın eli de herkesinki gibi sayılır",
  ],
  [/^A run can go on from 13 to 1$/, "Seri 13'ten 1'e devam edebilir"],
  [
    /^The most players who can sit at the table$/,
    "Masaya oturabilecek en çok oyuncu",
  ],
  [
    /^Sets of 53 tiles: two as usual, more for a bigger table$/,
    "53'lük taş takımı sayısı: normali iki, kalabalık masaya daha fazla",
  ],
  [
    /^Tiles dealt to each player; whoever starts gets one more$/,
    "Her oyuncuya dağıtılan taş; başlayan bir fazla alır",
  ],
  [
    /^Slots in each of the rack's two rows$/,
    "Istakanın iki sırasının her birindeki yer",
  ],
  [
    /^Out-of-turn takes each player has a round$/,
    "Her oyuncunun bir elde yandan alma hakkı",
  ],
  [
    /^Seconds the others have to take the discard once the player whose turn it is draws from the pile$/,
    "Sırası gelen desteden çektikten sonra diğerlerinin taşı alma süresi (sn)",
  ],
  [
    /^From this round a table okey can be taken before opening too; empty: only once you've opened$/,
    "Bu elden itibaren yerdeki okey açmadan da alınabilir; boşsa yalnız açtıktan sonra",
  ],
  [
    /^Tiles a pairs opener can add to sets and runs a turn; 0: no limit$/,
    "Çift açanın bir turda seri ve kütlere işleyebileceği taş; 0: sınırsız",
  ],
  [/^Written for whoever finishes$/, "Bitirene yazılan"],
  [/^Written for a player who didn't open$/, "Açamayana yazılan"],
  [
    /^Written for each okey left in a hand$/,
    "Elde kalan her okey için yazılan",
  ],
  [
    /^Written for throwing a tile that fit a table meld, when it's caught$/,
    "Yerdeki bir pere işleyen taşı atıp yakalanana yazılan",
  ],
  [
    /^Written for throwing the okey, unless it's the last tile; 0: none$/,
    "Okeyi atana yazılan, son taşı değilse; 0: yok",
  ],
  [
    /^Written for taking the discard and putting it back$/,
    "Yandan alıp geri bırakana yazılan",
  ],
  [
    /^Times in 100 a bot misses a good move: a discard to take, a catch, an opening, the best tile to throw; 0: it plays its best$/,
    "Bir botun 100 hamlede iyi bir hamleyi kaçırdığı sayı: yandan almak, yakalamak, açmak, atılacak en iyi taş; 0: en iyisini oynar",
  ],
  [
    /^Times in 100 a bot catches a thrown tile that fits a table meld; 100: every one$/,
    "Yerdeki bir pere işleyen atılan 100 taştan botun yakaladığı sayı; 100: hepsini",
  ],
  [/^default: (.+)$/, "varsayılan: $1"],
  [/^on$/, "açık"],
  [/^off$/, "kapalı"],
  [/^changed$/, "değişti"],
  [
    /^Never played this way: it may break mid-game$/,
    "Böyle hiç oynanmadı: oyun ortasında bozulabilir",
  ],
  [/^Untested rules$/, "Denenmemiş kurallar"],
  [/^(.+) put the tile back: \+(\d+)$/, "$1 taşı geri bıraktı: +$2"],
  [
    /^You opened with pairs: (\d+) tiles a turn$/,
    "Çift açtın: elde en fazla $1 taş işlersin",
  ],
  [/^You can take (\d+) a round$/, "Bir elde en fazla $1 taş alabilirsin"],
  [/^No tiles left for the extra draw$/, "Ekstra çekmek için taş kalmadı"],
  [
    /^Give the others (\d+)s to take the discard$/,
    "Diğerlerine taşı almaları için $1 sn ver",
  ],
  [/^Nothing to catch$/, "Yakalanacak taş yok"],
  [/^Already caught$/, "Zaten yakalandı"],
  [
    /^That tile didn't fit a meld when it was thrown$/,
    "Bu taş atıldığında yerdekilere işlemiyordu",
  ],
  [/^(.+) caught (.+)'s tile: \+(\d+)$/, "$1 yakaladı: $2 +$3"],
  [
    /^Lay down your tiles, then throw the last one to the middle$/,
    "Taşlarını yere aç, sonra sonuncuyu ortaya at",
  ],
  [
    /^Throw your last tile to the middle to finish$/,
    "Bitirmek için son taşını ortaya at",
  ],
  [/^(.+) finished round (\d+)( ×\d+)?$/, "$1 $2. eli bitirdi$3"],
  [/^Round (\d+): no tiles left$/, "$1. el: taş kalmadı"],
  [
    /^Round (\d+): no tiles left, dealt again$/,
    "$1. el: taş kalmadı, yeniden dağıtılır",
  ],
  [/^Round (\d+): dealt again$/, "$1. el yeniden dağıtılır"],
  [/^(.+) wins with (-?\d+)$/, "$1 kazandı: $2"],
  [/^(.+) & (.+) win with (-?\d+)$/, "$1 & $2 kazandı: $3"],
  [/^(.+) wins!$/, "$1 kazandı!"],
  [/^(.+) & (.+) win!$/, "$1 & $2 kazandı!"],
  [/^No tiles left$/, "Taş kalmadı"], // before "(.+) left"
  [/^Home on the left$/, "Ev solda"], // before "(.+) left"
  [/^(.+) left$/, "$1 ayrıldı"],
  [/^(.+) changed the rules$/, "$1 kuralları değiştirdi"],
  // how the round finished (LastTurn)
  [/^(.+) took the discard$/, "$1 yandan aldı"],
  [/^taken (\d+)\/(\d+)$/, "yandan $1/$2"],
  [/^just opened$/, "yeni açtı"], // before "(.+) opened"
  [/^(.+) opened$/, "$1 açtı"],
  [/^(.+) laid down$/, "$1 per indirdi"],
  [/^(.+) added to a meld$/, "$1 işledi"],
  [/^(.+) took an okey$/, "$1 okey aldı"],
  [/^(.+) finished$/, "$1 bitirdi"],
  [
    /^not enough players to start the game$/,
    "Başlamak için yeterli oyuncu yok",
  ],
  [/^That hand doesn't finish$/, "Bu el bitmiyor"],
  [/^Duplicate tile detected$/, "Aynı taştan fazla var"],
  [
    /^(.+) wants? (.+)'s (red|black|blue|yellow) (\d+)$/,
    (_, who, from, color, rank) =>
      `${who} istiyor: ${from} · ${COLORS[color]} ${rank}`,
  ],
  [/^(.+) wants? (.+)'s fake okey$/, "$1 istiyor: $2 · sahte okey"],
  // labels
  [/^Start$/, "Başlat"],
  [/^Game settings$/, "Oyun ayarları"],
  [/^Opening$/, "Açış"],
  [/^From the hand$/, "Elden bitir"],
  [/^Melds$/, "Perler"],
  [/^Points or pairs$/, "Sayı ya da çift"],
  [/^The table$/, "Masa"],
  [/^Opening and laying down$/, "Açmak ve işlemek"],
  [/^The discards$/, "Atılan taşlar"],
  [/^When the pile runs out$/, "Deste bitince"],
  [/^Bots$/, "Botlar"],
  [/^Opening points$/, "Açış sayısı"],
  [/^Opening pairs$/, "Açış çifti"],
  [/^Rounds$/, "Eller"],
  [/^Pair$/, "Çift"],
  [/^Add a meld$/, "Per ekle"],
  [/^Remove the round$/, "Eli kaldır"],
  [/^Add a round$/, "El ekle"],
  [/^or$/, "ya da"],
  [/^pairs$/, "çift"],
  [/^Keep on this device$/, "Bu cihazda sakla"],
  [/^Name$/, "Ad"],
  [/^Save$/, "Kaydet"],
  [/^Apply$/, "Uygula"],
  [/^Delete$/, "Sil"],
  [/^Undo changes$/, "Değişiklikleri geri al"],
  [/^Open your hand$/, "El aç"],
  [/^Open picked$/, "Seçilenleri aç"],
  [/^Find and open$/, "Bul ve aç"],
  [/^Lay melds$/, "Per aç"],
  [/^Update to the new version$/, "Yeni sürüme geç"],
  [/^Sound$/, "Ses"],
  [/^partner$/, "eş"],
  [/^Reset Game$/, "Oyunu sıfırla"],
  [/^New Game$/, "Yeni oyun"],
  [/^Deal this round again$/, "Bu eli yeniden dağıt"],
  [/^Next Round$/, "Sonraki el"],
  [/^Shuffle and play on$/, "Karıştır, devam et"],
  [/^End the round$/, "Eli bitir"],
  [/^Scores$/, "Puanlar"],
  [/^Total$/, "Toplam"],
  [/^Sit$/, "Otur"],
  [/^Stand$/, "Kalk"],
  [/^Leave the round$/, "Elden çekil"],
  [/^Add a bot$/, "Bot ekle"],
  [/^Add a bot: (.+)$/, "Bot ekle: $1"],
  [/^Sit down in this round$/, "Bu ele otur"],
  [/^away$/, "yok"],
  [/^Free seat: (.+)$/, "Yeri boşalt: $1"],
  [/^Player (\d+)$/, "Oyuncu $1"],
  [/^opened$/, "açtı"],
  [/^drew$/, "çekti"],
  [/^Table menu$/, "Masa menüsü"],
  [/^Sure\? Tap again$/, "Emin misin? Tekrar dokun"],
  [/^Saved games$/, "Kayıtlı oyunlar"],
  [/^Set up a game$/, "Oyun ayarla"],
  [/^Rules$/, "Kurallar"],
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
  [/^Catch!$/, "Yakala!"],
  [/^(.+)'s turn$/, "sıra: $1"],
  [/^Round (\d+)\/(\d+)$/, "El $1/$2"],
  [/^Turn your phone sideways to play$/, "Oynamak için telefonu yan çevir"],
  [
    /^Turn your phone sideways to play, and go full screen for a better experience$/,
    "Oynamak için telefonu yan çevir; daha iyi bir deneyim için tam ekrana geç",
  ],
  [/^Fullscreen$/, "Tam ekran"],
  [/^Menu$/, "Menü"],
  [/^Copy invite link$/, "Davet bağlantısını kopyala"],
  [/^Copied!$/, "Kopyalandı!"],
  // the site's menu (Menu.jsx)
  [/^Find a game$/, "Oyun bul"],
  [/^No game by that name$/, "Bu adda oyun yok"],
  [/^you$/, "sen"],
  [/^Change your name$/, "Adını değiştir"],
  [/^Sound Effects from$/, "Ses efektleri:"],
  [/^User:$/, "Kullanıcı:"],
  [/^Your name$/, "Adın"],
  [/^Go$/, "Gir"],
  // Backgammon (tavla)
  [/^White$/, "Beyaz"],
  [/^Black$/, "Siyah"],
  [/^Roll$/, "Zar at"],
  [/^Undo$/, "Geri al"],
  [/^Score$/, "Skor"],
  [/^Reset score$/, "Skoru sıfırla"],
  [/^Pips to go$/, "Kalan yol"],
  [/^Sit down to play$/, "Oynamak için otur"],
  [/^Play both sides$/, "İki tarafı da oyna"],
  [/^Face to face$/, "Karşılıklı"],
  [/^Waiting for a second player$/, "İkinci oyuncu bekleniyor"],
  [/^Waiting for (.+)$/, "$1 bekleniyor"],
  [/^(.+) starts$/, "$1 başlıyor"],
  [/^(.+): no moves$/, "$1: oynayacak hamle yok"],
  [/^Mars! 2 points$/, "Mars! 2 puan"],
  // TicTacToe, Go
  [/^Draw$/, "Berabere"],
  [/^That square is taken$/, "Bu kare dolu"],
  [/^That point is taken$/, "Orası dolu"],
  [/^That stone would have no liberties$/, "Orada taşın nefesi kalmaz"],
  [/^Ko: play elsewhere first$/, "Ko: önce başka yere oyna"],
  [/^Pass$/, "Pas"],
  [/^Prisoners$/, "Esirler"],
  [/^Board$/, "Tahta"],
  [/^Game$/, "Oyun"],
  [/^Classic$/, "Klasik"],
  [/^Super$/, "Süper"],
  [/^That board is decided$/, "O tahta bitti"],
  [/^Play in the lit board$/, "Işıklı tahtaya oyna"],
  [/^(.+) passed$/, "$1 pas geçti"],
  [/^(.+) wins by (.+)$/, "$1 $2 farkla kazandı"],
  [/^Next game$/, "Sonraki oyun"],
  [/^Play your checker on the bar first$/, "Önce kırık taşını oyna"],
  [
    /^Bring every checker home before bearing off$/,
    "Taş toplamadan önce bütün taşlarını eve getir",
  ],
  [
    /^Only one die can be played: it has to be the higher one$/,
    "Yalnız bir zar oynanabiliyor: büyük olan oynanmalı",
  ],
  [
    /^Every die that can be played has to be played$/,
    "Oynanabilen her zar oynanmalı",
  ],
  // the report form (Sentry's)
  [/^Report a problem$/, "Sorun bildir"],
  [/^What happened\?$/, "Ne oldu?"],
  [
    /^What did you see, and what did you expect\?$/,
    "Ne gördün, ne bekliyordun?",
  ],
  [/^\(required\)$/, "(zorunlu)"],
  [/^Send$/, "Gönder"],
  [/^Cancel$/, "Vazgeç"],
  [/^Done$/, "Tamam"],
  [/^Add a screenshot$/, "Ekran görüntüsü ekle"],
  [/^Remove screenshot$/, "Ekran görüntüsünü kaldır"],
  [/^Highlight$/, "Vurgula"],
  [/^Hide$/, "Gizle"],
  [/^Remove$/, "Kaldır"],
  [/^Thanks! Your report is on its way$/, "Teşekkürler! Bildirimin gönderildi"],
  [/^Couldn't send the report$/, "Bildirim gönderilemedi"],
  [/^Couldn't open the report form$/, "Bildirim formu açılamadı"],
];

// English keeps the game's own Turkish words out: küt is a set, seri a run,
// Elden the last round, finished from the hand
const EN = [
  [/(\d+)'l[üiıu] küt/g, "set of $1"],
  [/(\d+)'l[üiıu] seri/g, "run of $1"],
  [/(\d+) çift/g, "$1 pairs"],
  [/\bküt\b/g, "set"],
  [/\bseri\b/g, "run"],
  [/\bElden\b/g, "from hand"],
];

export function t(text, tr = turkish) {
  if (typeof text !== "string") return text;
  if (!tr) return EN.reduce((s, [re, to]) => s.replace(re, to), text);
  const hit = TR.find(([re]) => re.test(text));
  return hit ? text.replace(hit[0], hit[1]) : text;
}
