// Dijalankan sebelum halaman tampil supaya tema pilihan tidak "berkedip" saat dibuka.
(function () {
  try {
    var t = localStorage.getItem('anykey:v1:theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
