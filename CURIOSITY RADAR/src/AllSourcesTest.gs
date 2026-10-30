// Uses the SOURCES rows enabled by the administrator. Does not change their settings.
function startAllSourcesTest() { return startSourceTest_(true); }
function continueAllSourcesTest() { return continueSourceTest_(true); }
function getAllSourcesTestStatus() {
  var state = fourSourceTestState_(true) || {status:'NOT_STARTED'};
  console.log(JSON.stringify(state)); return state;
}
