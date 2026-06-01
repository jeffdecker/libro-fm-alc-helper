# Generating Promo Images for the Chrome Web Store

This project uses HTML/CSS (`promo.html`) to design the promotional assets for the Chrome Web Store. Below are two ways to convert this HTML file into the required high-quality `.png` files.

*Note: Chrome Web Store requires exact dimensions:*
* *Marquee Promo: `1400x560`*
* *Small Promo: `440x280`*

---

Use Chrome's built-in hidden screenshot tool to capture a pixel-perfect image of your HTML container.

1. Open `promo.html` in Google Chrome.
2. Right-click the main promo `<div>` and select **Inspect**.
3. Ensure the element is highlighted in the **Elements** panel.
4. Press `Ctrl + Shift + P` (Windows/Linux) or `Cmd + Shift + P` (Mac) to open the Command Menu.
5. Type `node screenshot` and select **Capture node screenshot**.

Chrome will instantly download a perfectly cropped `.png` of just that element.

---