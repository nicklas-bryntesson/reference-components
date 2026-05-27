How to test a toast snackbar

GIVEN THAT I am on a page with a toast snackbar

1 - Keyboard for mobile & desktop browser
- WHEN I use use features that trigger the toast I SEE the toast (BUT focus DOES NOT transfer automatically when the alert appears)

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use use features that trigger the toast
  - I HEAR The toast is read when it appears (BUT focus DOES NOT transfer automatically when the toast appears)
  - I HEAR It identifies itself as an alert or status when it appears
  - I HEAR If it is possible to close the toast, focus then returns to a logical place in the page
  - I HEAR It remains open until closed by user
3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I use features that trigger the toast snackbar
  - I HEAR The toast is read when it appears (BUT focus DOES NOT transfer automatically when the toast appears)
  - I HEAR It identifies itself as an alert or status when it appears
  - I HEAR If it is possible to close the toast, focus then returns to a logical place in the page
  - I HEAR It remains open until closed by user

Full information: https://www.atomica11y.com/accessible-web/toast-snackbar/
