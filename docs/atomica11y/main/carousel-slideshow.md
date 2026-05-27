How to test a carousel slideshow

GIVEN THAT I am on a page with a carousel slideshow

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to carousel controls (forward, backward, pause/play, stop) I SEE focus is strongly visually indicated
- THEN when I use the spacebar or enter key I SEE the intended action occurs
- OR WHEN when I use the arrow keys (optional) I SEE the slides advance or reverse

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to carousel controls (forward, backward, pause/play, stop)
  - I HEAR Control name and purpose is clear
  - I HEAR Control identifies itself as a button
  - I HEAR The number of slides and current position in the carousel is indicated
- THEN when I use the spacebar or enter key I HEAR the intended action occurs

- OR WHEN when I use the arrow keys (optional) I HEAR the slides advance or reverse

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to move focus to carousel controls (forward, backward, pause/play, stop)
  - I HEAR Control name and purpose is clear
  - I HEAR Control identifies itself as a button
  - I HEAR The number of slides and current position in the carousel is indicated
- THEN when I doubletap I HEAR the intended action occurs

4 - Device settings
- WHEN I use reduced motion THEN I see Carousel does not auto-advance, motion transitions are disabled

Full information: https://www.atomica11y.com/accessible-web/carousel/
