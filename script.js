import {
  auth, db, signInAnonymously, onAuthStateChanged,
  collection, doc, getDocs, addDoc, query, where, orderBy, onSnapshot, serverTimestamp
} from "./firebase.js";
import { defaultProducts } from "./products.js";

let products = [...defaultProducts];
let cart = [];
let currentCat = "All";
let payment = "Cash";
let customerUid = null;
let stopProductsListener = null;
let stopOrdersListener = null;

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toFixed(2);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const localOrderIdsKey = "norsuMyOrderIds";
let myOrderIds = JSON.parse(localStorage.getItem(localOrderIdsKey) || "[]");

function message(text, type="") {
  const el = $("orderMessage");
  el.textContent = text;
  el.className = "notice " + type;
}

function imageFor(p) {
  return p.imageUrl || `images/${p.file}`;
}

function showProducts() {
  const filtered = currentCat === "All" ? products : products.filter(p => p.cat === currentCat);
  $("products").innerHTML = filtered.map(p => `
    <div class="product" data-id="${p.id}">
      <div class="visual">
        <div class="price">₱${money(p.price)}</div>
        <img src="${escapeHTML(imageFor(p))}" alt="${escapeHTML(p.name)}" loading="lazy"
          onerror="this.outerHTML='<div class=&quot;no-pic&quot;>📸<br>No Picture Yet<br><small>${escapeHTML(p.name)}</small></div>'">
      </div>
      <div class="p-info">
        <div class="p-name">${escapeHTML(p.name)}</div>
        <div class="p-desc">${escapeHTML(p.desc || "")}</div>
        <div class="p-price">₱${money(p.price)}</div>
      </div>
    </div>`).join("");
  document.querySelectorAll(".product").forEach(el => el.addEventListener("click", () => {
    const item = products.find(p => String(p.id) === el.dataset.id);
    if (!item) return;
    cart.push({...item});
    showCart();
  }));
}

function showCart() {
  const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
  $("tot").textContent = money(total);
  $("cartCount").textContent = cart.length;
  $("count").textContent = `${cart.length} item${cart.length === 1 ? "" : "s"}`;
  if (!cart.length) {
    $("cartList").innerHTML = '<div class="small-muted">No items - Tap products!</div>';
    return;
  }
  $("cartList").innerHTML = cart.map((item, i) => `
    <span class="cart-chip">${escapeHTML(item.name)} ₱${money(item.price)}
      <button class="remove-item" type="button" data-remove="${i}" aria-label="Remove ${escapeHTML(item.name)}">×</button>
    </span>`).join("");
  document.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    cart.splice(Number(btn.dataset.remove), 1);
    showCart();
  }));
}

function renderMyOrders(rows) {
  const host = $("publicOrders");
  if (!rows.length) {
    host.innerHTML = '<div class="small-muted">No orders placed from this browser yet.</div>';
    return;
  }
  host.innerHTML = rows.map(o => {
    const status = o.status || "Pending";
    const cls = status.toLowerCase();
    return `<div class="order ${cls}">
      <div class="card-heading"><b>Order #${escapeHTML(o.shortId || o.id)}</b>
      <span class="status-badge">${escapeHTML(status)}</span></div>
      <div class="small-muted">${escapeHTML(o.createdAtText || "Recently placed")}</div>
      <div class="small-muted">${(o.items || []).map(i => `${escapeHTML(i.name)} × ${Number(i.quantity || 1)}`).join(", ")}</div>
      <b>Total: ₱${money(o.total)}</b>
    </div>`;
  }).join("");
}

function listenToMyOrders(uid) {
  if (stopOrdersListener) stopOrdersListener();
  const q = query(collection(db, "orders"), where("customerUid", "==", uid));
  stopOrdersListener = onSnapshot(q, snap => {
    const rows = snap.docs.map(d => ({id:d.id, ...d.data()}))
      .filter(o => myOrderIds.includes(o.id))
      .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderMyOrders(rows);
  }, err => {
    console.error(err);
    $("publicOrders").innerHTML = '<div class="small-muted">Unable to load order updates. Please refresh.</div>';
  });
}

function listenToProducts() {
  if (stopProductsListener) stopProductsListener();
  stopProductsListener = onSnapshot(collection(db, "products"), snap => {
    if (!snap.empty) {
      products = snap.docs.map(d => ({...d.data(), id:Number(d.id)})).sort((a,b) => a.id-b.id);
    } else {
      products = [...defaultProducts];
    }
    $("loadMessage").textContent = snap.empty
      ? "Showing the starter menu. The owner can publish the menu from the Admin page."
      : "Menu updated live.";
    showProducts();
  }, err => {
    console.error(err);
    products = [...defaultProducts];
    $("loadMessage").textContent = "Could not connect to the live menu. Showing the starter menu.";
    showProducts();
  });
}

async function placeOrder() {
  const button = $("placeBtn");
  const name = $("custName").value.trim();
  if (!name) return message("Please enter your name.", "error");
  if (!cart.length) return message("Your cart is empty. Please add an item first.", "error");
  const refNo = $("gcashRef").value.trim();
  const gcashNo = $("gcashNum").value.trim();
  if (payment === "GCash") {
    if (!refNo) return message("Please enter your GCash reference number.", "error");
    if (!/^09\d{9}$/.test(gcashNo)) return message("Enter a valid 11-digit GCash/mobile number starting with 09.", "error");
  }
  if (!auth.currentUser || auth.currentUser.isAnonymous !== true) {
    return message("Connecting securely. Please wait a moment and try again.", "error");
  }

  const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
  const items = cart.map(i => ({id:Number(i.id), name:String(i.name), price:Number(i.price), quantity:1}));
  button.disabled = true;
  message("Submitting your order...");
  try {
    const createdAtText = new Date().toLocaleString();
    const result = await addDoc(collection(db, "orders"), {
      customerUid: customerUid,
      name,
      items,
      total,
      status: "Pending",
      payment,
      gcashRef: payment === "GCash" ? refNo : "",
      gcashNumber: payment === "GCash" ? gcashNo : "",
      createdAt: serverTimestamp(),
      createdAtText
    });
    myOrderIds.push(result.id);
    myOrderIds = [...new Set(myOrderIds)].slice(-50);
    localStorage.setItem(localOrderIdsKey, JSON.stringify(myOrderIds));
    cart = [];
    showCart();
    $("custName").value = "";
    $("gcashRef").value = "";
    $("gcashNum").value = "";
    setPayment("Cash");
    message(`Order placed successfully! Your order number is ${result.id.slice(-6).toUpperCase()}. Track its status below.`, "success");
  } catch (err) {
    console.error(err);
    message("Order could not be submitted. Check your internet connection and Firebase setup, then try again.", "error");
  } finally {
    button.disabled = false;
  }
}

function setPayment(value) {
  payment = value;
  document.querySelectorAll(".pay").forEach(el => {
    el.classList.toggle("active", el.dataset.pay === value && value === "Cash");
    el.classList.toggle("gcash-active", el.dataset.pay === value && value === "GCash");
  });
  $("gcashBox").classList.toggle("show", value === "GCash");
}

document.querySelectorAll(".cat").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentCat = btn.dataset.cat;
  showProducts();
}));
document.querySelectorAll(".pay").forEach(btn => btn.addEventListener("click", () => setPayment(btn.dataset.pay)));
$("placeBtn").addEventListener("click", placeOrder);

const pageUrl = location.href.split("#")[0];
$("qrLink").textContent = pageUrl;
$("mainQR").src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent(pageUrl);
$("gcashQR").src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent("GCASH-09481114418-NORSU-CANTEEN");
$("year").textContent = new Date().getFullYear();

showProducts();
showCart();
renderMyOrders([]);

onAuthStateChanged(auth, async user => {
  if (user && user.isAnonymous) {
    customerUid = user.uid;
    listenToProducts();
    listenToMyOrders(user.uid);
  }
});
if (!auth.currentUser) {
  signInAnonymously(auth).catch(err => {
    console.error(err);
    $("loadMessage").textContent = "Firebase connection failed. Check firebase.js configuration and enable Anonymous Authentication.";
  });
}
