

const TELEGRAM_TOKEN = "8424319092:AAGfsEAizuQjslAABRiElMDtp0veabTBTLU";
const TELEGRAM_CHAT_ID = "1715556878";


// ===================================================
// Przechowywanie message_id dla każdej listy
let newOrdersMessageId = null;
let todoOrdersMessageId = null;
let payOrdersMessageId = null;
let paidOrdersMessageId = null;


// ===================================================


function doGet() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("Magazyn aromatu");
  const data = sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
  const inventory = {};
  data.forEach(r => inventory[r[0]] = Number(r[1]) || 0);
  return ContentService.createTextOutput(JSON.stringify(inventory))
    .setMimeType(ContentService.MimeType.JSON);
}


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


function handleOrderPost(body) {
  const ss = SpreadsheetApp.getActive();
  const ordersSheet = ss.getSheetByName("Zamówienia");


  const today = Utilities.formatDate(new Date(), "Europe/Warsaw", "dd/MM/yy");
  const newRow = ordersSheet.getLastRow() + 1;
  const orderNumber = newRow - 1;


  ordersSheet.getRange(newRow,1).setValue(today);
  ordersSheet.getRange(newRow,2).setValue(orderNumber);
  ordersSheet.getRange(newRow,3).setValue(body.name);
  ordersSheet.getRange(newRow,4).setValue(body.orderText);
  ordersSheet.getRange(newRow,5).setValue(body.total);
  ordersSheet.getRange(newRow,6).setValue(JSON.stringify(body.usedAromas));
  ordersSheet.getRange(newRow,7).setValue("NOWE");


  colorDayRows(ordersSheet);


  // zmniejszamy stan magazynu
  const invSheet = ss.getSheetByName("Magazyn aromatu");
  const rows = invSheet.getRange(2,1,invSheet.getLastRow()-1,2).getValues();
  Object.entries(body.usedAromas).forEach(([id, used]) => {
    rows.forEach((r,i) => {
      if(String(r[0]) === id){
        invSheet.getRange(i+2,2).setValue(r[1] - used);
      }
    });
  });


  sendOrUpdateNewOrdersList();
}


// ===================================================


function handleTelegramCallback(callback) {
  answerTelegramCallback(callback.id);


  const action = callback.data;


  // NOWE -> AKCEPTUJ
  if (action.startsWith("approve_")) {
    const row = Number(action.split("_")[1]);
    const ss = SpreadsheetApp.getActive();
    const ordersSheet = ss.getSheetByName("Zamówienia");
    ordersSheet.getRange(row,7).setValue("ZATWIERDZONE");


    sendOrUpdateNewOrdersList();
    sendOrUpdateTodoOrdersList();
    return;
  }


  // NOWE -> ANULUJ
  if (action.startsWith("cancel_")) {
    const row = Number(action.split("_")[1]);
    const ss = SpreadsheetApp.getActive();
    const ordersSheet = ss.getSheetByName("Zamówienia");
    const usedAromas = JSON.parse(ordersSheet.getRange(row,6).getValue() || "{}");


    const invSheet = ss.getSheetByName("Magazyn aromatu");
    const rows = invSheet.getRange(2,1,invSheet.getLastRow()-1,2).getValues();
    Object.entries(usedAromas).forEach(([id, used]) => {
      rows.forEach((r,i)=>{
        if(String(r[0]) === id){
          invSheet.getRange(i+2,2).setValue(r[1] + used);
        }
      });
    });


    ordersSheet.deleteRow(row);
    sendOrUpdateNewOrdersList();
    return;
  }


  // DO ZROBIENIA -> ZROBIONE
  if (action.startsWith("done_")) {
    const row = Number(action.split("_")[1]);
    const ss = SpreadsheetApp.getActive();
    const ordersSheet = ss.getSheetByName("Zamówienia");
    ordersSheet.getRange(row,7).setValue("DO ZAPŁATY");


    sendOrUpdateTodoOrdersList();
    sendOrUpdatePayOrdersList();
    return;
  }


  // DO ZAPŁATY -> ZAPŁACONE
  if (action.startsWith("paid_")) {
    const row = Number(action.split("_")[1]);
    const ss = SpreadsheetApp.getActive();
    const ordersSheet = ss.getSheetByName("Zamówienia");
    ordersSheet.getRange(row,7).setValue("ZAPŁACONE");


    sendOrUpdatePayOrdersList();
    sendOrUpdatePaidOrdersList();
    return;
  }
}


// ===================================================
// FUNKCJE WYŚWIETLANIA LIST


function sendOrUpdateNewOrdersList(){
  sendListByStatus("NOWE","🆕 NOWE ZAMÓWIENIA","approve","cancel","newOrdersMessageId");
}


function sendOrUpdateTodoOrdersList(){
  sendListByStatus("ZATWIERDZONE","🛠 ZAMÓWIENIA DO ZROBIENIA","done",null,"todoOrdersMessageId");
}


function sendOrUpdatePayOrdersList(){
  sendListByStatus("DO ZAPŁATY","💵 ZAMÓWIENIA DO ZAPŁATY","paid",null,"payOrdersMessageId");
}


function sendOrUpdatePaidOrdersList(){
  sendListByStatus("ZAPŁACONE","✅ ZAPŁACONE ZAMÓWIENIA",null,null,"paidOrdersMessageId");
}


// ===================================================
// FUNKCJA POMOCNICZA: lista z przyciskami
function sendListByStatus(status, title, buttonAction, buttonAction2, messageIdVar){
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("Zamówienia");
  const data = sheet.getDataRange().getValues();


  let text = `${title}:\n\n`;
  const keyboard = [];


  for(let i=1;i<data.length;i++){
    if(data[i][6]===status){
      const row=i+1;
      const nr=data[i][1];
      const klient=data[i][2];
      const zamowienie=data[i][3];
      const suma=data[i][4];


      text += `🧾 ${nr} | ${klient}\n${zamowienie}\n💰 ${Number(suma).toFixed(2)} zł\n\n`;


      let rowButtons = [];
      if(buttonAction) rowButtons.push({ text: buttonText(buttonAction,nr), callback_data: `${buttonAction}_${row}` });
      if(buttonAction2) rowButtons.push({ text: buttonText(buttonAction2,nr), callback_data: `${buttonAction2}_${row}` });
      if(rowButtons.length) keyboard.push(rowButtons);
    }
  }


  if(keyboard.length===0) text=`✅ Brak ${status.toLowerCase().replace("_"," ")} zamówień`;


  sendOrEditMessage(TELEGRAM_CHAT_ID,text,keyboard,messageIdVar);
}


function buttonText(action,nr){
  switch(action){
    case "approve": return `✅ Akceptuj ${nr}`;
    case "cancel": return `❌ Anuluj ${nr}`;
    case "done": return `✔ Zrobione ${nr}`;
    case "paid": return `💸 Zapłacone ${nr}`;
    default: return action;
  }
}


// ===================================================
// FUNKCJA WYSYŁKI LUB EDYCJI
function sendOrEditMessage(chatId,text,keyboard,messageIdVar){
  if(!this[messageIdVar]) this[messageIdVar] = null;


  const url = this[messageIdVar] ? 
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText` :
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;


  const payload = { chat_id: chatId, text: text };
  if(keyboard) payload.reply_markup = { inline_keyboard: keyboard };
  if(this[messageIdVar]) payload.message_id = this[messageIdVar];


  const res = UrlFetchApp.fetch(url,{
    method:"post",
    contentType:"application/json",
    payload: JSON.stringify(payload)
  });


  if(!this[messageIdVar]){
    const response = JSON.parse(res.getContentText());
    if(response.result && response.result.message_id) this[messageIdVar] = response.result.message_id;
  }
}


// ===================================================
function answerTelegramCallback(callbackId){
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`;
  UrlFetchApp.fetch(url,{
    method:"post",
    contentType:"application/json",
    payload: JSON.stringify({callback_query_id: callbackId})
  });
}


// ===================================================
function colorDayRows(sheet){
  const data = sheet.getDataRange().getValues();
  if(data.length < 2) return;


  const colors = ["#e3f2fd","#fce4ec","#e8f5e9","#fff3e0","#ede7f6","#f3e5f5","#e0f7fa","#f9fbe7"];
  let colorIndex=-1;
  let lastDate="";


  for(let i=1;i<data.length;i++){
    const rowDate=data[i][0];
    if(rowDate!==lastDate){ colorIndex=(colorIndex+1)%colors.length; lastDate=rowDate;}
    sheet.getRange(i+1,1,1,sheet.getLastColumn()).setBackground(colors[colorIndex]);
  }
}
