import {
  auth, db, storage,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
  ref, uploadBytes, getDownloadURL
} from "./firebase.js";
import { defaultProducts } from "./products.js";

const OWNER_EMAIL = "REPLACE_WITH_YOUR_OWNER_EMAIL";
const $ = id => document.getElementById(id);
let stopProducts = null;
let stopOrders = null;
let products = [];
const money = n => Number(n || 0).toFixed(2);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notice(text, type="") { $("adminNotice").textContent=text; $("adminNotice").className="notice "+type; }

function isOwner(user) {
  return !!user && !user.isAnonymous && user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}
function showPanel(user) {
  $("loginSection").hidden = !!user;
  $("adminPanel").hidden = !user;
  if (user) {
    $("signedInAs").textContent = "Signed in as: " + user.email;
    startLiveData();
  } else {
    if (stopProducts) stopProducts();
    if (stopOrders) stopOrders();
    stopProducts = stopOrders = null;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email=$("adminEmail").value.trim();
  const password=$("adminPassword").value;
  $("loginMessage").textContent="Signing in...";
  try {
    const credential = await signInWithEmailAndPassword(auth,email,password);
    if (!isOwner(credential.user)) {
      await signOut(auth);
      $("loginMessage").textContent="This account is not the configured owner account.";
      return;
    }
    $("loginMessage").textContent="";
  } catch(err) {
    console.error(err);
    $("loginMessage").textContent="Login failed. Check your email, password, and Firebase Authentication settings.";
  }
}

function startLiveData() {
  if (stopProducts) stopProducts();
  if (stopOrders) stopOrders();
  stopProducts = onSnapshot(collection(db,"products"), snap => {
    products = snap.empty ? [...defaultProducts] : snap.docs.map(d=>({...d.data(),id:Number(d.id)})).sort((a,b)=>a.id-b.id);
    showProductManager();
  }, err => { console.error(err); notice("Could not load products. Check Firestore rules."); });
  const oq = query(collection(db,"orders"), orderBy("createdAt","desc"));
  stopOrders = onSnapshot(oq, snap => {
    showOrders(snap.docs.map(d=>({id:d.id,...d.data()})));
  }, err => { console.error(err); $("adminOrders").textContent="Unable to load orders. Check Firestore rules."; });
}

function showProductManager() {
  $("productManager").innerHTML = products.map(p => `
    <div class="prod-item">
      <div>
        <img class="prod-thumb" src="${esc(p.imageUrl || `images/${p.file}`)}" alt="${esc(p.name)}"
          onerror="this.style.opacity='.25';this.alt='No picture'">
        <div style="font-size:9px;color:${p.imageUrl?'#16a34a':'#ef4444'};font-weight:800">${p.imageUrl?'✅ Picture uploaded':'📷 Default image / no upload'}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:12px">${p.id}. ${esc(p.name)} - ₱${money(p.price)}</div>
        <div style="font-size:10px;color:#777">images/${esc(p.file)} | ${esc(p.cat)}</div>
        <input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${p.id}" style="margin-top:6px;width:100%">
        <div style="font-size:9px;color:#0f2e1f;margin-top:2px">Upload a JPG, PNG, or WebP image (max 5 MB).</div>
      </div>
    </div>`).join("");
  document.querySelectorAll("[data-upload]").forEach(input=>input.addEventListener("change", async e=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const id=Number(input.dataset.upload);
    if(!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size>5*1024*1024) {
      notice("Please choose a JPG, PNG, or WebP image no larger than 5 MB.","error"); input.value=""; return;
    }
    input.disabled=true; notice("Uploading picture...");
    try {
      const storageRef=ref(storage,`product-images/${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`);
      await uploadBytes(storageRef,file,{contentType:file.type});
      const url=await getDownloadURL(storageRef);
      await updateDoc(doc(db,"products",String(id)),{imageUrl:url,updatedAt:serverTimestamp()});
      notice(`Picture updated for ${products.find(p=>p.id===id)?.name}.`,"success");
    } catch(err) {
      console.error(err); notice("Picture upload failed. Check Firebase Storage setup and Storage Rules.","error");
    } finally { input.disabled=false; input.value=""; }
  }));
}

async function publishStarterMenu() {
  if(!isOwner(auth.currentUser)) return notice("Owner authentication required.","error");
  if(!confirm("Publish or reset the Firestore menu to the 23 starter products and latest prices? Existing uploaded image URLs will be preserved where possible.")) return;
  $("seedBtn").disabled=true;
  try {
    const existing=await getDocs(collection(db,"products"));
    const byId=new Map(existing.docs.map(d=>[Number(d.id),d.data()]));
    for(const p of defaultProducts) {
      const old=byId.get(p.id) || {};
      await setDoc(doc(db,"products",String(p.id)),{
        ...p,
        ...(old.imageUrl ? {imageUrl:old.imageUrl}:{}),
        updatedAt:serverTimestamp()
      });
    }
    notice("Starter menu published successfully. Customers can now see the menu.","success");
  } catch(err) {
    console.error(err); notice("Could not publish menu. Check Firestore Rules and that you are signed in as owner.","error");
  } finally { $("seedBtn").disabled=false; }
}

function showOrders(rows) {
  if(!rows.length) { $("adminOrders").innerHTML='<div class="small-muted" style="text-align:center;padding:20px">No orders yet. New customer orders will appear here automatically.</div>'; return; }
  $("adminOrders").innerHTML=rows.map(o=>{
    const status=o.status||"Pending";
    const cls=status.toLowerCase();
    const items=(o.items||[]).map(it=>`${esc(it.name)} × ${Number(it.quantity||1)}`).join(", ");
    return `<div class="order ${cls}">
      <div class="card-heading"><b>#${esc(o.id.slice(-6).toUpperCase())} · ${esc(o.name)} · ₱${money(o.total)}</b>
        <span class="status-badge">${esc(status)}</span></div>
      <div class="small-muted">${esc(o.createdAtText||"Order received")}</div>
      <div style="font-size:11px;margin:5px 0">${items}</div>
      <div style="font-size:11px;background:${o.payment==="GCash"?"#DBEAFE":"#FEF3C7"};padding:7px;border-radius:8px">
        Payment: <b>${esc(o.payment)}</b>
        ${o.payment==="GCash"?`<br>Reference: ${esc(o.gcashRef)}<br>Customer GCash No.: ${esc(o.gcashNumber)}`:""}
      </div>
      <div class="order-buttons">
        <button class="btn" data-status="${o.id}|Pending" style="background:#ddd">Pending</button>
        <button class="btn" data-status="${o.id}|Preparing" style="background:#3b82f6;color:white">Accept - Preparing</button>
        <button class="btn" data-status="${o.id}|Ready" style="background:#16a34a;color:white">Done - Ready</button>
        <button class="btn" data-delete="${o.id}" style="background:red;color:white">Delete</button>
      </div>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-status]").forEach(btn=>btn.addEventListener("click",async()=>{
    const [id,status]=btn.dataset.status.split("|");
    try { await updateDoc(doc(db,"orders",id),{status,updatedAt:serverTimestamp()}); }
    catch(err) { console.error(err); notice("Could not update order status.","error"); }
  }));
  document.querySelectorAll("[data-delete]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("Delete this order permanently?")) return;
    try { await deleteDoc(doc(db,"orders",btn.dataset.delete)); }
    catch(err) { console.error(err); notice("Could not delete order.","error"); }
  }));
}

$("loginForm").addEventListener("submit",handleLogin);
$("seedBtn").addEventListener("click",publishStarterMenu);
$("refreshBtn").addEventListener("click",()=>startLiveData());
$("logoutBtn").addEventListener("click",()=>signOut(auth));
const customerUrl=new URL("index.html",location.href).href;
$("adminQrLink").textContent=customerUrl;
$("adminQR").src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data="+encodeURIComponent(customerUrl);

onAuthStateChanged(auth,user=>{
  if(user && !isOwner(user)) {
    signOut(auth);
    showPanel(null);
    $("loginMessage").textContent="This account is not authorized as the owner.";
    return;
  }
  showPanel(user);
});
