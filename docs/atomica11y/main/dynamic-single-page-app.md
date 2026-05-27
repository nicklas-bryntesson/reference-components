How to test a dynamic single page app

GIVEN THAT I am on a page with a dynamic single page app

1 - Keyboard for mobile & desktop browser
- WHEN I use the application AND whole new dynamic page appears I SEE browsing and focus starts consistently at top of new page content or top of page
- THEN when I use the tab key I SEE focus starts consistently at the first interactive element in the new page content or top of page

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the application AND whole new dynamic page appears
  - I HEAR New content is announced or indicated 
  - I HEAR Browsing and focus starts consistently at top of new page content or top of page
- THEN when I use the tab key I HEAR focus starts consistently at the first interactive element in the new page content or top of page

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I use the application AND new dynamic content page appears
  - I HEAR New content is announced or indicated 
  - I HEAR Browsing and focus starts consistently at top of new page content or top of page

Full information: https://www.atomica11y.com/accessible-web/aria-live/
