How to test an iframe

GIVEN THAT I am on a page with an iframe

1 - Keyboard for mobile & desktop browser
- WHEN I use the arrow keys or tab key I SEE the content of the iframe is browsed

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the arrow keys or tab key
  - I HEAR The title of the iframe is read if the iframe contains content 
  - I HEAR If the iframe does not contain content, the iframe is ignored
3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to content in the iframe
  - I HEAR The title of the iframe is read if the iframe contains content 
  - I HEAR If the iframe does not contain content, the iframe is ignored

Full information: https://www.atomica11y.com/accessible-web/iframe/
