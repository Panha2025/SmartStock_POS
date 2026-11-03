// This classic script also works on file://, where browsers block ES module startup.
if (location.protocol === 'file:') {
  const main=document.getElementById('main');
  main.textContent='Start SmartStock with RUN_ON_MAC.command, RUN_ON_WINDOWS.bat, or npm start. Then open http://127.0.0.1:4173/. Opening index.html directly cannot run the local database app.';
  main.classList.add('fatal-error');
}
