
const TELEGRAM_TOKEN = "8424319092:AAGfsEAizuQjslAABRiElMDtp0veabTBTLU";
const TELEGRAM_CHAT_ID = "1715556878";

// ===================================================
//  CONFIG – Message IDs zapisujemy w Properties
// ===================================================

const PROP_NEW = "MSG_NEW";
const PROP_TODO = "MSG_TODO";
const PROP_PAY = "MSG_PAY";

// ===================================================

function doPost(e) {

  const data = JSON.parse(e.postData.contents);

  if (data.callback_query) {
    handleTelegramCallback(data.callback_query);
    return ContentService.createTextOutput("OK");
  }

  if (data.name && data.orderText) {
    handleOrderPost(data);
    return ContentService.createTextOutput("OK");
  }

  return ContentService.createTextOutput("OK");
}

// ===================================================
//  NOWE ZAMÓWIENIE
// ===================================================

function handleOrderPost(body){

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("Zamówienia");

  const today = Utilities.formatDate(new Date(), "Europe/Warsaw", "dd/MM/yy");

  const row = sheet.getLastRow()+1;
  const nr = row-1;

  sheet.getRange(row,1,7).setValues([[
    today,
    nr,
    body.name,
    body.orderText,
    body.total,
    JSON.stringify(body.usedAromas),
    "NOWE"
  ]]);

  colorDayRows(sheet);

  refreshAllLists();
}

// ===================================================
//  CALLBACK
// ===================================================

function handleTelegramCallback(cb){

  answerTelegramCallback(cb.id);

  const action = cb.data;
  const row = Number(action.split("_")[1]);

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("Zamówienia");

  // ---------- AKCEPTUJ ----------
  if(action.startsWith("approve_")){
    sheet.getRange(row,7).setValue("ZATWIERDZONE");
  }

  // ---------- ZROBIONE ----------
  if(action.startsWith("done_")){
    sheet.getRange(row,7).setValue("DO_ZAPLATY");
  }

  // ---------- ZAPLACONE ----------
  if(action.startsWith("paid_")){
    sheet.getRange(row,7).setValue("ZAPLACONE");
  }

  // ---------- ANULUJ ----------
  if(action.startsWith("cancel_")){
    sheet.deleteRow(row);
  }

  refreshAllLists();
}

// ===================================================
//  REFRESH ALL 3 LISTS
// ===================================================

function refreshAllLists(){

  sendNewOrdersList();
  sendTodoOrdersList();
  sendPayOrdersList();
}

// ===================================================
//  SEND / EDIT MESSAGE
// ===================================================

function sendOrEdit(propName, text, keyboard){

  const props = PropertiesService.getScriptProperties();
  let msgId = props.getProperty(propName);

  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    reply_markup: { inline_keyboard: keyboard }
  };

  let url;

  if(msgId){
    url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`;
    payload.message_id = Number(msgId);
  } else {
    url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  }

  const res = UrlFetchApp.fetch(url,{
    method:"post",
    contentType:"application/json",
    payload: JSON.stringify(payload)
  });

  if(!msgId){
    const json = JSON.parse(res.getContentText());
    props.setProperty(propName, json.result.message_id);
  }
}

// ===================================================
//  LISTA NOWE
// ===================================================

function sendNewOrdersList(){

  const sheet = SpreadsheetApp.getActive().getSheetByName("Zamówienia");
  const data = sheet.getDataRange().getValues();

  let text = "🚨 NOWE ZAMÓWIENIA:\n\n";
  const keyboard=[];

  for(let i=1;i<data.length;i++){
    if(data[i][6]==="NOWE"){
      const row=i+1;
      text+=`🧾 ${data[i][1]} | ${data[i][2]}
${data[i][3]}
💰 ${data[i][4]} zł\n\n`;

      keyboard.push([
        {text:"✅ Akceptuj",callback_data:`approve_${row}`},
        {text:"❌ Anuluj",callback_data:`cancel_${row}`}
      ]);
    }
  }

  if(!keyboard.length) text="✅ Brak nowych zamówień";

  sendOrEdit(PROP_NEW,text,keyboard);
}

// ===================================================
//  LISTA DO ZROBIENIA
// ===================================================

function sendTodoOrdersList(){

  const sheet = SpreadsheetApp.getActive().getSheetByName("Zamówienia");
  const data = sheet.getDataRange().getValues();

  let text="🛠 DO ZROBIENIA:\n\n";
  const keyboard=[];

  for(let i=1;i<data.length;i++){
    if(data[i][6]==="ZATWIERDZONE"){
      const row=i+1;

      text+=`🧾 ${data[i][1]} | ${data[i][2]}
${data[i][3]}\n\n`;

      keyboard.push([
        {text:"✔ Zrobione",callback_data:`done_${row}`}
      ]);
    }
  }

  if(!keyboard.length) text="✅ Nic do zrobienia";

  sendOrEdit(PROP_TODO,text,keyboard);
}

// ===================================================
//  LISTA DO ZAPLATY
// ===================================================

function sendPayOrdersList(){

  const sheet = SpreadsheetApp.getActive().getSheetByName("Zamówienia");
  const data = sheet.getDataRange().getValues();

  let text="💳 DO ZAPŁATY:\n\n";
  const keyboard=[];

  for(let i=1;i<data.length;i++){
    if(data[i][6]==="DO_ZAPLATY"){
      const row=i+1;

      text+=`🧾 ${data[i][1]} | ${data[i][2]}
${data[i][3]}
💰 ${data[i][4]} zł\n\n`;

      keyboard.push([
        {text:"💵 Zapłacone",callback_data:`paid_${row}`}
      ]);
    }
  }

  if(!keyboard.length) text="✅ Wszystko opłacone";

  sendOrEdit(PROP_PAY,text,keyboard);
}

// ===================================================

function answerTelegramCallback(id){

  UrlFetchApp.fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`,
    {
      method:"post",
      contentType:"application/json",
      payload:JSON.stringify({callback_query_id:id})
    }
  );
}

// ===================================================

function colorDayRows(sheet){

  const data=sheet.getDataRange().getValues();
  if(data.length<2) return;

  const colors=["#e3f2fd","#fce4ec","#e8f5e9","#fff3e0"];

  let last="";
  let idx=-1;

  for(let i=1;i<data.length;i++){
    if(data[i][0]!==last){
      idx=(idx+1)%colors.length;
      last=data[i][0];
    }

    sheet.getRange(i+1,1,1,sheet.getLastColumn())
      .setBackground(colors[idx]);
  }
}
