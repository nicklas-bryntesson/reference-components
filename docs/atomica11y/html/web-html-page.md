How to test a web html page

GIVEN THAT I am on a page with a web html page

1 - Keyboard for mobile & desktop browser
- WHEN I use the keyboard to open a new web page I SEE the page has a unique logical title in the browser tab

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the keyboard to open a new web page
  - I HEAR The page has a unique logical title in the browser tab
  - I HEAR Landmarks and forms are discoverable with screenreader shortcuts
3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to enter from the web browser tabs
  - I HEAR The page has a unique logical title in the browser tab
  - I HEAR Landmarks and forms are discoverable with screenreader shortcuts
- THEN when I change orientations I HEAR content is accessible in landscape or portrait orientation

4 - Device settings
- WHEN I use text-sizing THEN I see text can resize up to 200% without losing information
- WHEN I use orientation THEN I see content is accessible in landscape or portrait orientation
- WHEN I use browser zoom THEN I see Content zooms up to 400% without horizontal scrolling

Full information: https://www.atomica11y.com/accessible-web/html/
