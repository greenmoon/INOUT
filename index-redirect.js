'use strict';
// Only device selection crosses the redirect; never forward arbitrary destinations or credentials.
const target=new URL('INOUT_MQTT_DASHBOARD_V08.html',window.location.href);
const ids=new URLSearchParams(window.location.search).getAll('id');
for(const id of ids)target.searchParams.append('id',id);
document.getElementById('dashboardLink').href=target.href;
window.location.replace(target.href);
