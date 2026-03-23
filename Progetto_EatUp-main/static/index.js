"use strict";

// ===== MOBILE MENU TOGGLE =====
const toggle = document.getElementById("mobileToggle");
const menu = document.getElementById("mobileMenu");
const menuIcon = document.getElementById("menuIcon");
const closeIcon = document.getElementById("closeIcon");

toggle.addEventListener("click", function () {
  const isOpen = menu.classList.toggle("open");
  menuIcon.style.display = isOpen ? "none" : "block";
  closeIcon.style.display = isOpen ? "block" : "none";
});

// Close mobile menu when clicking a link
menu.querySelectorAll(".nav-link").forEach(function (link) {
  link.addEventListener("click", function () {
    menu.classList.remove("open");
    menuIcon.style.display = "block";
    closeIcon.style.display = "none";
  });
});

// ===== LOGIN MODAL =====
const overlay = document.getElementById("loginOverlay");
const btnLogin = document.getElementById("btnLogin");
const btnLoginMobile = document.getElementById("btnLoginMobile");
const btnModalClose = document.getElementById("modalClose");
const btnCancel = document.getElementById("btnCancel");
const btnOk = document.getElementById("btnOk");

function openModal() {
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

btnLogin.addEventListener("click", openModal);
btnLoginMobile.addEventListener("click", openModal);
btnModalClose.addEventListener("click", closeModal);
btnCancel.addEventListener("click", closeModal);

// Close on overlay click (outside the box)
overlay.addEventListener("click", function (e) {
  if (e.target === overlay) {
    closeModal();
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && overlay.classList.contains("open")) {
    closeModal();
  }
});

btnOk.addEventListener("click", function () {
  var user = document.getElementById("txtUser").value;
  var pass = document.getElementById("txtPass").value;
  if (!user || !pass) {
    alert("Inserisci username e password.");
    return;
  }
  alert("Login effettuato con: " + user);
  closeModal();
});
