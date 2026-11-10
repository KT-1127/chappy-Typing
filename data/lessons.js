/* ステップ練習のレッスン。
 * type: keys = キーの組み合わせ練習（そのまま打つ）
 *       kana = かなの組み合わせ（ローマ字で打つ）
 *       list = 決まった言葉のリスト
 *       words / sentences = 問題データから出題
 * goal: [★2 の速さ, ★3 の速さ]（打/分）。★1 は正確さ 90% 以上でクリア */
(function () {
const KEY_LESSONS = [
  { id: "fj", title: "人さし指（F・J）", note: "出っぱりのある F と J に人さし指を置こう", type: "keys", keys: "fj", count: 10, goal: [70, 110] },
  { id: "homeL", title: "ホーム段・左手", note: "A S D F に左手の指を置いたまま打とう", type: "keys", keys: "asdfg", count: 10, goal: [80, 120] },
  { id: "homeR", title: "ホーム段・右手", note: "J K L ; に右手の指を置いたまま打とう", type: "keys", keys: "hjkl;", count: 10, goal: [80, 120] },
  { id: "home", title: "ホーム段・両手", note: "打ったら、すぐにホームポジションにもどろう", type: "keys", keys: "asdfghjkl;", count: 10, goal: [90, 140] },
  { id: "top", title: "上の段", note: "指をまっすぐ上にのばして打とう", type: "keys", keys: "qwertyuiop", mix: "asdfjkl", count: 10, goal: [90, 140] },
  { id: "bottom", title: "下の段", note: "指を少し内側に曲げて打とう", type: "keys", keys: "zxcvbnm,.", mix: "asdfjkl", count: 10, goal: [80, 130] },
  { id: "alpha", title: "すべての英字", note: "手元を見ないで打てるかな？", type: "keys", keys: "abcdefghijklmnopqrstuvwxyz", count: 10, goal: [100, 160] },
];

const JA_LESSONS = [
  { id: "vowel", title: "母音（あいうえお）", note: "ローマ字の基本。A I U E O の位置を覚えよう", type: "kana", kana: "あいうえお", count: 10, goal: [90, 140] },
  { id: "ksT", title: "か行・さ行・た行", note: "子音のあとに母音を打つよ", type: "kana", kana: "かきくけこさしすせそたちつてと", count: 10, goal: [110, 160] },
  { id: "nhm", title: "な行・は行・ま行", note: "ふ は fu でも hu でも打てるよ", type: "kana", kana: "なにぬねのはひふへほまみむめも", count: 10, goal: [110, 160] },
  { id: "yrw", title: "や行・ら行・わ行・ん", note: "ん は、次が子音なら n 1回でもいいよ", type: "kana", kana: "やゆよらりるれろわをん", count: 10, goal: [110, 160] },
  { id: "daku", title: "濁音・半濁音", note: "が は ga、ぱ は pa", type: "kana", kana: "がぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ", count: 10, goal: [110, 160] },
  { id: "youon", title: "小さい ゃ ゅ ょ", note: "きゃ は kya、しゃ は sha でも sya でも OK", type: "kana", kana: ["きゃ","きゅ","きょ","しゃ","しゅ","しょ","ちゃ","ちゅ","ちょ","にゃ","ひゃ","みゅ","りょ","ぎゃ","じゃ","じゅ","じょ","びょ","ぴゅ"], count: 10, goal: [110, 160] },
  { id: "sokuon", title: "小さい っ と のばす音", note: "っ は次の子音を2回。ー はキーボードの「-」", type: "list",
    list: [["きって","きって"],["がっこう","がっこう"],["ケーキ","ケーキ"],["ノート","ノート"],["にっき","にっき"],["コーヒー","コーヒー"],["ざっし","ざっし"],["スーパー","スーパー"],["はっぱ","はっぱ"],["ロケット","ロケット"],["ちょっと","ちょっと"],["シール","シール"]],
    count: 10, goal: [120, 170] },
  { id: "words", title: "単語", note: "ここまでの総まとめ。短い言葉を打とう", type: "words", diff: "easy", count: 10, goal: [130, 190] },
  { id: "phrases", title: "短い言葉", note: "漢字の読みを見て打とう", type: "words", diff: "normal", count: 8, goal: [140, 200] },
  { id: "sentences", title: "文章", note: "句読点「、」「。」も忘れずに", type: "sentences", diff: "hard", count: 5, goal: [150, 220] },
];

const EN_LESSONS = [
  { id: "num", title: "数字の段", note: "数字は、上の段からさらに上へ指をのばそう", type: "keys", keys: "1234567890", count: 10, goal: [70, 110] },
  { id: "caps", title: "大文字（Shift）", note: "大文字は、反対の手の小指で Shift を押しながら打とう", type: "list",
    list: ["Apple","Tokyo","Monday","Japan","Chappy","Ocean","Green","Kyoto","River","Sunday","London","Hello"].map((t) => t), count: 10, goal: [90, 140] },
  { id: "punct", title: "記号（, . ! ?）", note: "記号の位置も覚えよう", type: "list",
    list: ["Hi, Tom.","Yes!","Why?","Oh, no!","Wait, please.","Good job!","Really?","Thank you.","Me, too.","Let's go!","Okay.","How are you?"], count: 10, goal: [90, 140] },
  { id: "short", title: "短い単語", note: "単語ごとのリズムをつかもう", type: "words", diff: "easy", count: 10, goal: [120, 180] },
  { id: "long", title: "長い単語", note: "あわてず、正確に", type: "words", diff: "normal", count: 8, goal: [140, 200] },
  { id: "sentences", title: "文章", note: "スペースと大文字・記号も正確に", type: "sentences", diff: "hard", count: 5, goal: [150, 220] },
];

window.LESSONS = {
  ja: KEY_LESSONS.concat(JA_LESSONS),
  en: KEY_LESSONS.concat(EN_LESSONS),
};
})();
