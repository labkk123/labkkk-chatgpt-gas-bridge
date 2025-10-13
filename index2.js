const fetch = require("node-fetch");

// ここをあなたのGAS Web App URLに置き換える
const GAS_URL = "https://script.google.com/macros/s/AKfycbyvrWFOp8afJwRjREQs98NFE8hBNseHNWLV6j4rTIN9JdEP96BFO0-bYhdXa-HqC9ooEA/exec";

// GASに送るメモのデータ
const memoData = {
  action: "addMemo",
  data: {
    word: "run into",
    meaning: "偶然出会う",
    example: "I ran into my old friend at the station.",
    memo: ""
  }
};

async function addMemo() {
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memoData)
    });

    const json = await res.json();
    console.log("GAS Web App からの返却:", json);

  } catch (err) {
    console.error("エラー:", err);
  }
}

addMemo();
