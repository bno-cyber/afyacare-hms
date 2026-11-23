const STORAGE_KEY = "afyacre_hms_data_v1";

const DEPT_FEES = {
  "General OPD": 1500,
  "Pediatrics": 2000,
  "Maternity": 2500,
  "Emergency": 3000
};

const WARD_FEES = {
  "W-GEN": 1200,
  "W-MAT": 1800,
  "W-PED": 1500
};

const ROLE_TABS = {
  Admin: ["dashboard", "patients", "wards", "clinical", "lab", "pharmacy", "staff", "billing"],
  Doctor: ["dashboard", "patients", "wards", "clinical", "lab"],
  Nurse: ["dashboard", "patients", "wards", "pharmacy"],
  Reception: ["dashboard", "patients", "wards", "billing"],
  Pharmacist: ["dashboard", "pharmacy"],
  "Lab Tech": ["dashboard", "lab"]
};

const DEFAULT_DATA = {
  currentUser: null,
  staff: [],
  patients: [],
  wards: [
    { id: "W-GEN", name: "General Medical Ward", totalBeds: 6, occupied: [] },
    { id: "W-MAT", name: "Maternity Ward", totalBeds: 4, occupied: [] },
    { id: "W-PED", name: "Pediatric Ward", totalBeds: 4, occupied: [] }
  ],
  pharmacy: [
    { id: "MED-1", name: "Amoxicillin 500mg (Pack)", price: 450, stock: 35 },
    { id: "MED-2", name: "Artemether-Lumefantrine (Dose)", price: 600, stock: 28 },
    { id: "MED-3", name: "Paracetamol 500mg (Strip)", price: 200, stock: 50 },
    { id: "MED-4", name: "ORS & Zinc Pack", price: 300, stock: 22 }
  ],
  ehrRecords: [],
  labRequests: [],
  prescriptions: [],
  invoices: []
};

let hospitalData = loadData();

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_DATA),
      ...parsed,
      wards: Array.isArray(parsed.wards) && parsed.wards.length ? parsed.wards : structuredClone(DEFAULT_DATA.wards),
      pharmacy: Array.isArray(parsed.pharmacy) && parsed.pharmacy.length ? parsed.pharmacy : structuredClone(DEFAULT_DATA.pharmacy),
      staff: Array.isArray(parsed.staff) ? parsed.staff : [],
      patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      ehrRecords: Array.isArray(parsed.ehrRecords) ? parsed.ehrRecords : [],
      labRequests: Array.isArray(parsed.labRequests) ? parsed.labRequests : [],
      prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : []
    };
  } catch (err) {
    console.error("Failed to load hospital data:", err);
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hospitalData));
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hospitalData));
}

function formatStatusPill(statusText) {
  const s =(statusText || "").toLowerCase();
  let cls = "pill-discharged";
  if (s.includes("waiting") || s.includes("pending") || s.includes("unpaid")) cls = "pill-waiting";
  else if (s.includes("admitted") || s.includes("consulted")) cls = "pill-admitted";
  else if (s.includes("paid") || s.includes("dispensed") || s.includes("sent") || s === "in stock") cls = "pill-paid";
  else if (s.includes("low") || s.includes("out")) cls = "pill-lowstock";
  return `<span class="status-pill ${cls}">${statusText}</span>`
}

async function hashPassword(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function seedDefaultStaffIfNeeded() {
  if (hospitalData.staff.length > 0) return;

  const defaults = [
    { name: "System Admin", email: "admin@afyacare.co.ke", role: "Admin", pass: "Admin@123" },
    { name: "Dr. Brian Otieno", email: "doctor@afyacare.co.ke", role: "Doctor", pass: "Doc@123" },
    { name: "Nurse Faith Wambui", email: "nurse@afyacare.co.ke", role: "Nurse", pass: "Nurse@123" },
    { name: "David Kiprop", email: "reception@afyacare.co.ke", role: "Reception", pass: "Rec@123" },
    { name: "Pharmacist Samuel Njoroge", email: "pharmacist@afyacare.co.ke", role: "Pharmacist", pass: "Pharm@123" },
    { name: "Lab Tech Lucy Akinyi", email: "lab@afyacare.co.ke", role: "Lab Tech", pass: "Lab@123" }
  ];

  for (const acc of defaults) {
    hospitalData.staff.push({
      id: "STF-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
      name: acc.name,
      email: acc.email.toLowerCase(),
      role: acc.role,
      passwordHash: await hashPassword(acc.pass),
      active: true
    });
  }
  saveData();
}

function getAllowedTabs() {
  const role = hospitalData.currentUser?.role;
  return ROLE_TABS[role] || ["dashboard"];
}

function applySessionUI() {
  const loginScreen = document.getElementById("login-screen");
  const appShell = document.getElementById("app-shell");
  const badge = document.getElementById("current-user-badge");
  if (!loginScreen || !appShell) return;

  if (!hospitalData.currentUser) {
    loginScreen.style.display = "flex";
    appShell.style.display = "none";
    if (badge) badge.textContent = "Logged in: Guest";
    return;
  }

  loginScreen.style.display = "none";
  appShell.style.display = "flex";

  if (badge) {
    badge.textContent = `Logged in: ${hospitalData.currentUser.name} (${hospitalData.currentUser.role})`;
  }

  const allowed = getAllowedTabs();
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const tab = btn.dataset.tab;
    btn.style.display = allowed.includes(tab) ? "block" : "none";
  });

  const regCard = document.getElementById("registration-card") || document.getElementById("patient-form")?.closest(".card");
  if (regCard) {
    regCard.style.display = hospitalData.currentUser.role === "Doctor" ? "none" : "block";
  }

  const activeSection = document.querySelector(".tab-section.active");
  if (!activeSection || !allowed.includes(activeSection.id)) {
    switchTab(allowed[0] || "dashboard");
  }
}

function switchTab(tabId) {
  const allowed = getAllowedTabs();
  if (!allowed.includes(tabId)) return;

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === tabId);
  });

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  const pageTitle = document.getElementById("page-title");
  if (activeBtn && pageTitle) {
    pageTitle.textContent = activeBtn.textContent;
  }
}

function bindNavigationAndLogin() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      hospitalData.currentUser = null;
      saveData();
      applySessionUI();
    });
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("login-email");
      const passInput = document.getElementById("login-password");
      const errorBox = document.getElementById("login-error");

      const email = (emailInput?.value || "").trim().toLowerCase();
      const password = passInput?.value || "";

      const user = hospitalData.staff.find((s) => s.email.toLowerCase() === email);
      if (!user || !user.active) {
        if (errorBox) {
          errorBox.textContent = "Account not found or inactive.";
          errorBox.style.display = "block";
        }
        return;
      }

      const enteredHash = await hashPassword(password);
      if (enteredHash !== user.passwordHash) {
        if (errorBox) {
          errorBox.textContent = "Invalid email or password.";
          errorBox.style.display = "block";
        }
        return;
      }

      if (errorBox) errorBox.style.display = "none";
      hospitalData.currentUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      saveData();
      if (passInput) passInput.value = "";
      applySessionUI();
      renderAll();
    });
  }
}

function ensureOpenInvoice(patient) {
  let invoice = hospitalData.invoices.find((inv) => inv.patientId === patient.id && !inv.paid);
  if (!invoice) {
    invoice = {
      id: "INV-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
      patientId: patient.id,
      patientName: patient.name,
      items: [],
      paid: false,
      createdAt: new Date().toLocaleString()
    };
    hospitalData.invoices.push(invoice);
  }
  return invoice;
}

function bindForms() {
  const patientForm = document.getElementById("patient-form");
  if (patientForm) {
    patientForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (hospitalData.currentUser?.role === "Doctor") {
        alert("Doctors do not have permission to register patients.");
        return;
      }

      const name = document.getElementById("p-name").value.trim();
      const age = Number(document.getElementById("p-age").value);
      const gender = document.getElementById("p-gender").value;
      const phone = document.getElementById("p-phone").value.trim();
      const dept = document.getElementById("p-dept").value;
      const vitals = document.getElementById("p-vitals").value.trim();
      const fee = DEPT_FEES[dept] || 1500;

      const patientId = "PT-" + crypto.randomUUID().slice(0, 6).toUpperCase();
      const newPatient = {
        id: patientId,
        name,
        age,
        gender,
        phone,
        dept,
        vitals,
        status: "Waiting",
        createdAt: new Date().toLocaleString()
      };
      hospitalData.patients.push(newPatient);

      const inv = ensureOpenInvoice(newPatient);
      inv.items.push({ label: `${dept} Consultation`, amount: fee });

      saveData();
      patientForm.reset();
      renderAll();
    });
  }

  const clinicalForm = document.getElementById("clinical-form");
  if (clinicalForm) {
    clinicalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const patientId = document.getElementById("clinical-patient-select").value;
      const chiefComplaint = document.getElementById("history-complaint")?.value.trim() || "";
      const hpi = document.getElementById("history-hpi")?.value.trim() || "";
      const pastHistory = document.getElementById("history-pmh")?.value.trim() || "";
      const diagnosis = document.getElementById("clinical-diagnosis").value.trim();
      const [labName, labPriceStr] = document.getElementById("clinical-lab").value.split("|");
      const labPrice = Number(labPriceStr) || 0;
      const rxId = document.getElementById("clinical-rx").value;

      const patient = hospitalData.patients.find((p) => p.id === patientId);
      if (!patient) return;

      const doctorName = hospitalData.currentUser?.name || "Doctor";
      const timestamp = new Date().toLocaleString();
      const invoice = ensureOpenInvoice(patient);
      const itemsAdded = [];

      if (labName !== "None") {
        if (labPrice > 0) {
          itemsAdded.push({ label: `Lab: ${labName}`, amount: labPrice });
        }
        hospitalData.labRequests.unshift({
          id: "LAB-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
          patientId,
          patientName: patient.name,
          requestedBy: doctorName,
          testName: labName,
          status: "Pending",
          result: "",
          date: timestamp
        });
      }

      let rxText = "None";
      let rxStatus = "None";
      if (rxId) {
        const med = hospitalData.pharmacy.find((m) => m.id === rxId);
        if (!med || med.stock <= 0) {
          alert("Selected medication is out of stock. Please restock or choose another medication.");
          return;
        }
        rxText = `${med.name} (x1)`;
        rxStatus = "Pending at Pharmacy";
        hospitalData.prescriptions.unshift({
          id: "RX-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
          patientId,
          patientName: patient.name,
          prescribedBy: doctorName,
          medId: med.id,
          medName: med.name,
          qty: 1,
          status: "Pending",
          date: timestamp
        });
      }

      if (itemsAdded.length > 0) {
        invoice.items.push(...itemsAdded);
      }

      if (!patient.status.toLowerCase().startsWith("admitted")) {
        patient.status = "Consulted";
      }

      const ehrId = "EHR-" + crypto.randomUUID().slice(0, 6).toUpperCase();
      hospitalData.ehrRecords.unshift({
        id: ehrId,
        patientId,
        patientName: patient.name,
        doctor: doctorName,
        chiefComplaint,
        hpi,
        pastHistory,
        diagnosis,
        lab: labName === "None" ? "None" : labName,
        labResult: labName === "None" ? "N/A" : "Pending",
        rx: rxText,
        rxStatus,
        date: timestamp
      });

      saveData();
      clinicalForm.reset();
      renderAll();
    });
  }

  const printHistoryBtn = document.getElementById("print-history-btn");
  if (printHistoryBtn) {
    printHistoryBtn.addEventListener("click", printCurrentHistory);
  }

  const restockForm = document.getElementById("restock-form");
  if (restockForm) {
    restockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const medId = document.getElementById("restock-med-select").value;
      const qty = Number(document.getElementById("restock-qty").value);
      const med = hospitalData.pharmacy.find((m) => m.id === medId);
      if (med && qty > 0) {
        med.stock += qty;
        saveData();
        renderAll();
      }
    });
  }

  const addMedForm = document.getElementById("add-med-form");
  if (addMedForm) {
    addMedForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("new-med-name").value.trim();
      const price = Number(document.getElementById("new-med-price").value);
      const stock = Number(document.getElementById("new-med-stock").value);

      if (!name || price <= 0 || stock < 0) return;

      hospitalData.pharmacy.push({
        id: "MED-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
        name,
        price,
        stock
      });

      saveData();
      addMedForm.reset();
      renderAll();
    });
  }

  const createStaffForm = document.getElementById("create-staff-form");
  if (createStaffForm) {
    createStaffForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("staff-name").value.trim();
      const email = document.getElementById("staff-email").value.trim().toLowerCase();
      const role = document.getElementById("staff-role").value;
      const password = document.getElementById("staff-password").value;

      if (hospitalData.staff.some((s) => s.email === email)) {
        alert("A staff account with that email already exists.");
        return;
      }

      hospitalData.staff.push({
        id: "STF-" + crypto.randomUUID().slice(0, 6).toUpperCase(),
        name,
        email,
        role,
        passwordHash: await hashPassword(password),
        active: true
      });

      saveData();
      createStaffForm.reset();
      renderStaffAccounts();
    });
  }
}

function bindFilters() {
  document.getElementById("opd-search")?.addEventListener("input", renderPatients);
  document.getElementById("opd-status-filter")?.addEventListener("change", renderPatients);
  document.getElementById("billing-search")?.addEventListener("input", renderBilling);
  document.getElementById("billing-status-filter")?.addEventListener("change", renderBilling);
}

function renderDashboard() {
  const container = document.getElementById("dashboard-stats");
  if (!container) return;

  const isAdmin = hospitalData.currentUser?.role === "Admin";
  const totalRevenue = hospitalData.invoices
    .filter((inv) => inv.paid)
    .reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + item.amount, 0), 0);

  const lowStockCount = hospitalData.pharmacy.filter((m) => m.stock <= 10).length;

  const cards = [
    `<div class="stat-box"><span>Registered Patients</span><strong>${hospitalData.patients.length}</strong></div>`,
    `<div class="stat-box"><span>EHR Consultations</span><strong>${hospitalData.ehrRecords.length}</strong></div>`,
    `<div class="stat-box"><span>Low Stock Meds</span><strong>${lowStockCount}</strong></div>`
  ];

  if (isAdmin) {
    cards.push(
      `<div class="stat-box"><span>Paid Revenue</span><strong>KES ${totalRevenue.toLocaleString()}</strong></div>`
    );
  }

  container.innerHTML = cards.join("");
}

function renderPatients() {
  const tbody = document.getElementById("patients-table-body");
  const select = document.getElementById("clinical-patient-select");
  const role = hospitalData.currentUser?.role;
  const canAdmit = role === "Admin" || role === "Doctor";

  const query = (document.getElementById("opd-search")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("opd-status-filter")?.value || "All";

  if (select) {
    select.innerHTML = hospitalData.patients.length
      ? hospitalData.patients.map((p) => `<option value="${p.id}">${p.name} (${p.dept})</option>`).join("")
      : `<option value="">No patients registered</option>`;
  }

  if (!tbody) return;

  const filteredPatients = hospitalData.patients.filter((p) => {
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.phone || "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Admitted"
        ? p.status.toLowerCase().startsWith("admitted")
        : p.status.toLowerCase() === statusFilter.toLowerCase());

    return matchesSearch && matchesStatus;
  });

  tbody.innerHTML = filteredPatients.length
    ? filteredPatients
        .map(
          (p) => `
      <tr>
        <td>${p.name} (${p.age}y, ${p.gender})</td>
        <td>${p.dept}</td>
        <td>${p.vitals}</td>
        <td>${formatStatusPill(p.status)}</td>
        <td>${
          canAdmit
            ? `<button type="button" class="btn-small" onclick="admitPatientPrompt('${p.id}')">Admit</button>`
            : `<span style="color: #64748b;">View Only</span>`
        }</td>
      </tr>
    `
        )
        .join("")
    : `<tr><td colspan="5" style="color: #64748b;">No matching patients found.</td></tr>`;
}

function admitPatientPrompt(patientId) {
  const role = hospitalData.currentUser?.role;
  if (role !== "Admin" && role !== "Doctor") {
    alert("Only Doctors and Admins can admit patients.");
    return;
  }

  const wardIdInput = prompt("Enter Ward ID to admit (W-GEN, W-MAT, or W-PED):", "W-GEN");
  if (!wardIdInput) return;
  const wardId = wardIdInput.trim().toUpperCase();
  const ward = hospitalData.wards.find((w) => w.id === wardId);
  const patient = hospitalData.patients.find((p) => p.id === patientId);
  if (!ward || !patient) {
    alert("Invalid ward or patient.");
    return;
  }

  if (ward.occupied.length >= ward.totalBeds) {
    alert("Selected ward is full.");
    return;
  }

  if (!ward.occupied.includes(patient.id)) {
    ward.occupied.push(patient.id);
    patient.status = `Admitted (${ward.name})`;

    const admissionFee = WARD_FEES[ward.id] ?? 1200;
    const invoice = ensureOpenInvoice(patient);
    invoice.items.push({
      label: `Ward Admission (${ward.name})`,
      amount: admissionFee
    });

    saveData();
    renderAll();
  }
}

function dischargePatient(wardId, patientId) {
  const role = hospitalData.currentUser?.role;
  if (role !== "Admin" && role !== "Doctor") {
    alert("Only Doctors and Admins can discharge patients.");
    return;
  }

  const ward = hospitalData.wards.find((w) => w.id === wardId);
  const patient = hospitalData.patients.find((p) => p.id === patientId);
  if (!ward || !patient) return;

  ward.occupied = ward.occupied.filter((id) => id !== patientId);
  patient.status = "Discharged";

  saveData();
  renderAll();
}

function renderWards() {
  const grid = document.getElementById("wards-grid");
  if (!grid) return;

  const role = hospitalData.currentUser?.role;
  const canDischarge = role === "Admin" || role === "Doctor";

  grid.innerHTML = hospitalData.wards
    .map((w) => {
      const admittedList = w.occupied
        .map((pid, idx) => {
          const p = hospitalData.patients.find((pt) => pt.id === pid);
          if (!p) return "";
          return `
            <li style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 0.85rem;">
              <strong>Bed ${idx + 1}: ${p.name}</strong> (${p.age}y, ${p.gender})<br />
              <span>Dept: ${p.dept} | Phone: ${p.phone}</span><br />
              <span>Vitals: ${p.vitals}</span>
              ${
                canDischarge
                  ? `<br /><button type="button" class="btn-discharge" onclick="dischargePatient('${w.id}', '${p.id}')">Discharge Patient</button>`
                  : ""
              }
            </li>
          `;
        })
        .join("");

      return `
        <div class="ward-card">
          <h4>${w.name}</h4>
          <p>Beds Occupied: ${w.occupied.length} / ${w.totalBeds}</p>
          ${
            w.occupied.length > 0
              ? `<ul style="list-style: none; margin-top: 8px;">${admittedList}</ul>`
              : `<p style="margin-top: 8px; font-size: 0.85rem; color: #64748b;">No patients currently admitted.</p>`
          }
        </div>
      `;
    })
    .join("");
}

function buildPrintableHistoryHtml(record) {
  return `
    <h3>AfyaCare Hospital — Patient Clinical History</h3>
    <p><strong>Record ID:</strong> ${record.id}</p>
    <p><strong>Patient:</strong> ${record.patientName}</p>
    <p><strong>Date:</strong> ${record.date}</p>
    <p><strong>Doctor:</strong> ${record.doctor}</p>
    <hr />
    <p><strong>Chief Complaint:</strong> ${record.chiefComplaint || "N/A"}</p>
    <p><strong>History of Presenting Illness:</strong> ${record.hpi || "N/A"}</p>
    <p><strong>Past Medical History / Allergies:</strong> ${record.pastHistory || "N/A"}</p>
    <p><strong>Diagnosis / Notes:</strong> ${record.diagnosis}</p>
    <hr />
    <p><strong>Lab Requested:</strong> ${record.lab} | <strong>Result:</strong> ${record.labResult || "Pending"}</p>
    <p><strong>Medication Prescribed:</strong> ${record.rx} | <strong>Status:</strong> ${record.rxStatus || "Pending"}</p>
  `;
}

function printCurrentHistory() {
  const patientSelect = document.getElementById("clinical-patient-select");
  const patientName = patientSelect?.selectedOptions?.[0]?.textContent || "Selected Patient";
  const draftRecord = {
    id: "DRAFT-" + new Date().getTime().toString().slice(-5),
    patientName,
    date: new Date().toLocaleString(),
    doctor: hospitalData.currentUser?.name || "Doctor",
    chiefComplaint: document.getElementById("history-complaint")?.value.trim() || "",
    hpi: document.getElementById("history-hpi")?.value.trim() || "",
    pastHistory: document.getElementById("history-pmh")?.value.trim() || "",
    diagnosis: document.getElementById("clinical-diagnosis")?.value.trim() || "",
    lab: document.getElementById("clinical-lab")?.value.split("|")[0] || "None",
    labResult: "Pending",
    rx: document.getElementById("clinical-rx")?.selectedOptions?.[0]?.textContent || "None",
    rxStatus: "Pending"
  };

  const modal = document.getElementById("receipt-modal");
  const content = document.getElementById("receipt-content");
  if (!modal || !content) return;
  content.innerHTML = buildPrintableHistoryHtml(draftRecord);
  modal.style.display = "flex";
}

function printEhrRecord(ehrId) {
  const rec = hospitalData.ehrRecords.find((r) => r.id === ehrId);
  const modal = document.getElementById("receipt-modal");
  const content = document.getElementById("receipt-content");
  if (!rec || !modal || !content) return;
  content.innerHTML = buildPrintableHistoryHtml(rec);
  modal.style.display = "flex";
}

function renderClinical() {
  const rxSelect = document.getElementById("clinical-rx");
  if (rxSelect) {
    rxSelect.innerHTML =
      `<option value="">None</option>` +
      hospitalData.pharmacy
        .map((m) => {
          const outOfStock = m.stock <= 0;
          return `<option value="${m.id}" ${outOfStock ? "disabled" : ""}>${m.name} - KES ${m.price} (${outOfStock ? "OUT OF STOCK" : `${m.stock} left`})</option>`;
        })
        .join("");

    let warningEl = document.getElementById("rx-stock-warning");
    if (!warningEl) {
      warningEl = document.createElement("div");
      warningEl.id = "rx-stock-warning";
      warningEl.className = "stock-warning";
      rxSelect.insertAdjacentElement("afterend", warningEl);
    }

    const updateRxWarning = () => {
      const selectedMed = hospitalData.pharmacy.find((m) => m.id === rxSelect.value);
      if (selectedMed && selectedMed.stock <= 0) {
        warningEl.textContent = `${selectedMed.name} is currently out of stock (0 left).`;
      } else if (selectedMed && selectedMed.stock <= 5) {
        warningEl.textContent = `Low stock alert: only ${selectedMed.stock} unit(s) left for ${selectedMed.name}.`;
      } else {
        warningEl.textContent = "";
      }
    };

    rxSelect.onchange = updateRxWarning;
    updateRxWarning();
  }

  const list = document.getElementById("ehr-records-list");
  if (!list) return;

  list.innerHTML = hospitalData.ehrRecords.length
    ? hospitalData.ehrRecords
        .map(
          (r) => `
          <div class="ehr-item">
            <strong>${r.patientName}</strong> — <em>${r.date}</em><br />
            <span>Doctor: ${r.doctor}</span><br />
            <span><strong>Chief Complaint:</strong> ${r.chiefComplaint || "N/A"}</span><br />
            <span><strong>HPI:</strong> ${r.hpi || "N/A"}</span><br />
            <span><strong>PMH / Allergies:</strong> ${r.pastHistory || "N/A"}</span><br />
            <p><strong>Diagnosis:</strong> ${r.diagnosis}</p>
            <span><strong>Lab:</strong> ${r.lab} (Result: ${r.labResult || "Pending"})</span><br />
            <span><strong>Rx:</strong> ${r.rx} (${r.rxStatus || "Pending"})</span><br />
            <button type="button" class="btn-small" onclick="printEhrRecord('${r.id}')">Print History</button>
          </div>
        `
        )
        .join("")
    : `<p>No clinical records yet.</p>`;
}

function printLabRequest(reqId) {
  const req = hospitalData.labRequests.find((r) => r.id === reqId);
  const modal = document.getElementById("receipt-modal");
  const content = document.getElementById("receipt-content");
  if (!req || !modal || !content) return;

  content.innerHTML = `
    <h3>AfyaCare Hospital — Laboratory Request Form</h3>
    <p><strong>Request ID:</strong> ${req.id}</p>
    <p><strong>Patient:</strong> ${req.patientName}</p>
    <p><strong>Requested By:</strong> ${req.requestedBy}</p>
    <p><strong>Date:</strong> ${req.date}</p>
    <hr />
    <p><strong>Test Ordered:</strong> ${req.testName}</p>
    <p><strong>Status:</strong> ${req.status}</p>
    <p><strong>Lab Result:</strong> ${req.result || "Awaiting completion"}</p>
  `;
  modal.style.display = "flex";
}

function completeLabTest(reqId) {
  const role = hospitalData.currentUser?.role;
  if (role !== "Lab Tech" && role !== "Admin") {
    alert("Only Lab Technicians and Admins can submit lab results.");
    return;
  }

  const input = document.getElementById(`lab-result-input-${reqId}`);
  const resultText = (input?.value || "").trim();
  if (!resultText) {
    alert("Please enter the lab result before sending to the doctor.");
    return;
  }

  const req = hospitalData.labRequests.find((r) => r.id === reqId);
  if (!req) return;

  req.result = resultText;
  req.status = "Sent to Doctor";
  req.completedBy = hospitalData.currentUser?.name || "Lab Tech";
  req.completedAt = new Date().toLocaleString();

  const matchingEhr = hospitalData.ehrRecords.find(
    (e) => e.patientId === req.patientId && e.lab === req.testName && (!e.labResult || e.labResult === "Pending")
  );
  if (matchingEhr) {
    matchingEhr.labResult = `${resultText} (by ${req.completedBy})`;
  }

  saveData();
  renderAll();
}

function renderLabRequests() {
  const tbody = document.getElementById("lab-requests-body");
  if (!tbody) return;

  const role = hospitalData.currentUser?.role;
  const canSubmitResult = role === "Lab Tech" || role === "Admin";

  tbody.innerHTML = hospitalData.labRequests.length
    ? hospitalData.labRequests
        .map(
          (r) => `
        <tr>
          <td>${r.id}</td>
          <td>${r.patientName}</td>
          <td>${r.requestedBy}</td>
          <td>${r.testName}</td>
          <td>${formatStatusPill(r.status)}</td>
          <td>
            <button type="button" class="btn-small" onclick="printLabRequest('${r.id}')">Print Request</button>
            ${
              canSubmitResult && r.status !== "Sent to Doctor"
                ? `<input type="text" id="lab-result-input-${r.id}" class="table-input" placeholder="Enter test result..." />
                   <button type="button" class="btn-small" onclick="completeLabTest('${r.id}')">Send Result to Doctor</button>`
                : `<div><small><strong>Result:</strong> ${r.result || "Pending"}</small></div>`
            }
          </td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="6" style="color: #64748b;">No lab requests from doctors yet.</td></tr>`;
}

function dispensePrescription(rxId) {
  const role = hospitalData.currentUser?.role;
  if (role !== "Pharmacist" && role !== "Admin") {
    alert("Only Pharmacists and Admins can dispense prescriptions.");
    return;
  }

  const rx = hospitalData.prescriptions.find((item) => item.id === rxId);
  if (!rx || rx.status === "Dispensed") return;

  const med = hospitalData.pharmacy.find((m) => m.id === rx.medId);
  if (!med || med.stock < rx.qty) {
    alert(`Insufficient stock for ${rx.medName}. Please restock first.`);
    return;
  }

  med.stock -= rx.qty;
  rx.status = "Dispensed";
  rx.dispensedBy = hospitalData.currentUser?.name || "Pharmacist";
  rx.dispensedAt = new Date().toLocaleString();

  const patient = hospitalData.patients.find((p) => p.id === rx.patientId);
  if (patient) {
    const invoice = ensureOpenInvoice(patient);
    invoice.items.push({
      label: `Rx: ${med.name} (x${rx.qty})`,
      amount: med.price * rx.qty
    });
  }

  const matchingEhr = hospitalData.ehrRecords.find(
    (e) => e.patientId === rx.patientId && e.rx.startsWith(med.name)
  );
  if (matchingEhr) {
    matchingEhr.rxStatus = `Dispensed by ${rx.dispensedBy}`;
  }

  saveData();
  renderAll();
}

function renderPrescriptionQueue() {
  const tbody = document.getElementById("rx-queue-body");
  if (!tbody) return;

  const role = hospitalData.currentUser?.role;
  const canDispense = role === "Pharmacist" || role === "Admin";

  tbody.innerHTML = hospitalData.prescriptions.length
    ? hospitalData.prescriptions
        .map((rx) => {
          const med = hospitalData.pharmacy.find((m) => m.id === rx.medId);
          const available = med ? med.stock : 0;
          return `
            <tr>
              <td>${rx.id}</td>
              <td>${rx.patientName}</td>
              <td>${rx.prescribedBy}</td>
              <td>${rx.medName} (x${rx.qty}) — <em>${available} in stock</em></td>
              <td>${formatStatusPill(rx.status)}</td>
              <td>
                ${
                  canDispense && rx.status !== "Dispensed"
                    ? `<button type="button" class="btn-small" onclick="dispensePrescription('${rx.id}')">Dispense</button>`
                    : `<span>${rx.status === "Dispensed" ? `Dispensed (${rx.dispensedBy || ""})` : "View Only"}</span>`
                }
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6" style="color: #64748b;">No prescriptions sent by doctors yet.</td></tr>`;
}

function renderPharmacy() {
  renderPrescriptionQueue();

  const select = document.getElementById("restock-med-select");
  if (select) {
    select.innerHTML = hospitalData.pharmacy
      .map((m) => `<option value="${m.id}">${m.name} (${m.stock} in stock)</option>`)
      .join("");
  }

  const tbody = document.getElementById("pharmacy-table-body");
  if (!tbody) return;

  tbody.innerHTML = hospitalData.pharmacy
    .map(
      (m) => `
      <tr>
        <td>${m.name}</td>
        <td>KES ${m.price.toLocaleString()}</td>
        <td>${m.stock}</td>
        <td>${formatStatusPill(m.stock <= 0 ? "Out of Stock" : m.stock <= 10 ? "Low Stock" : "In Stock")}</td>
      </tr>
    `
    )
    .join("");
}

function renderBilling() {
  const tbody = document.getElementById("billing-table-body");
  if (!tbody) return;

  const query = (document.getElementById("billing-search")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("billing-status-filter")?.value || "All";

  const filteredInvoices = hospitalData.invoices.filter((inv) => {
    const matchesSearch = !query || inv.patientName.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Paid" && inv.paid) ||
      (statusFilter === "Unpaid" && !inv.paid);
    return matchesSearch && matchesStatus;
  });

  tbody.innerHTML = filteredInvoices.length
    ? filteredInvoices
        .map((inv) => {
          const total = inv.items.reduce((sum, item) => sum + item.amount, 0);
          const breakdown = inv.items.map((i) => `${i.label} (KES ${i.amount.toLocaleString()})`).join(", ");
          return `
        <tr>
          <td>${inv.patientName}</td>
          <td>${breakdown}</td>
          <td>KES ${total.toLocaleString()}</td>
          <td>${formatStatusPill(inv.paid ? "Paid" : "Unpaid")}</td>
          <td>
            ${!inv.paid ? `<button type="button" class="btn-small" onclick="markInvoicePaid('${inv.id}')">Mark Paid</button>` : ""}
            <button type="button" class="btn-small" onclick="openReceipt('${inv.id}')">Receipt</button>
          </td>
        </tr>
      `;
        })
        .join("")
    : `<tr><td colspan="5" style="color: #64748b;">No matching invoices found.</td></tr>`;
}

function markInvoicePaid(invoiceId) {
  const inv = hospitalData.invoices.find((i) => i.id === invoiceId);
  if (inv) {
    inv.paid = true;
    saveData();
    renderAll();
  }
}

function openReceipt(invoiceId) {
  const inv = hospitalData.invoices.find((i) => i.id === invoiceId);
  const modal = document.getElementById("receipt-modal");
  const content = document.getElementById("receipt-content");
  if (!inv || !modal || !content) return;

  const total = inv.items.reduce((sum, item) => sum + item.amount, 0);
  content.innerHTML = `
    <h3>AfyaCare Hospital Receipt</h3>
    <p><strong>Invoice:</strong> ${inv.id}</p>
    <p><strong>Patient:</strong> ${inv.patientName}</p>
    <p><strong>Date:</strong> ${inv.createdAt}</p>
    <hr />
    ${inv.items.map((item) => `<p>${item.label}: KES ${item.amount.toLocaleString()}</p>`).join("")}
    <hr />
    <p><strong>Total: KES ${total.toLocaleString()}</strong> (${inv.paid ? "PAID" : "UNPAID"})</p>
  `;
  modal.style.display = "flex";
}

function closeReceipt() {
  const modal = document.getElementById("receipt-modal");
  if (modal) modal.style.display = "none";
}

function renderStaffAccounts() {
  const tbody = document.getElementById("staff-table-body");
  if (!tbody) return;

  tbody.innerHTML = hospitalData.staff
    .map(
      (s) => `
      <tr>
        <td>${s.name}</td>
        <td>${s.email}</td>
        <td>${s.role}</td>
        <td>${s.active ? "Active" : "Disabled"}</td>
        <td><button type="button" onclick="toggleStaffActive('${s.id}')">${s.active ? "Disable" : "Enable"}</button></td>
      </tr>
    `
    )
    .join("");
}

function renderAll() {
  renderDashboard();
  renderPatients();
  renderWards();
  renderClinical();
  renderLabRequests();
  renderPharmacy();
  renderStaffAccounts();
  renderBilling();
}

function toggleStaffActive(staffId) {
  const member = hospitalData.staff.find((s) => s.id === staffId);
  if (!member) return;
  if (hospitalData.currentUser && member.id === hospitalData.currentUser.id) {
    alert("You cannot disable your own active session.");
    return;
  }
  member.active = !member.active;
  saveData();
  renderStaffAccounts();
}

async function initApp() {
  await seedDefaultStaffIfNeeded();
  bindNavigationAndLogin();
  bindForms();
  bindFilters();
  applySessionUI();
  renderAll();
}

initApp();