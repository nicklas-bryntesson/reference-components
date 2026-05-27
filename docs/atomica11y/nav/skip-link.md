How to test a skip link

GIVEN THAT I am on a page with a skip link

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a skip link I SEE focus is strongly visually indicated
- THEN when I use the enter key to activate the link I SEE my focus moves directly to the targeted element

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a skip link
  - I HEAR It describes which landmark it's targeting
  - I HEAR It identifies itself as a link
  - I HEAR It is typically the first element in the page
- THEN when I use the enter key to activate the link I HEAR my focus moves directly to the targeted element

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a skip link
  - I HEAR It describes which landmark it's targeting
  - I HEAR It identifies itself as a link
  - I HEAR It is typically the first element in the page
- THEN when I doubletap with the link in focus I HEAR my focus moves directly to the targeted element

Full information: https://www.atomica11y.com/accessible-web/skip-link/
