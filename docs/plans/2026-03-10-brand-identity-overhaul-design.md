# Brand Identity Overhaul — Design

Date: 2026-03-10
Status: Approved

## Problem

The current frontend uses light cream/white backgrounds with subtle warm accents — a refined, elegant SaaS aesthetic. The ALFA Chopp brand identity (from their Instagram posts) is the opposite: bold black backgrounds, dominant yellow (#E8B912) accents, high contrast, party/delivery energy.

## Decision

Restyle all storefront-facing components to match the brand: dark backgrounds, bold yellow, high energy. Checkout form and order tracker stay lighter for form usability.

## Color Strategy

- Body default: bg-brand-dark (#0D0D0D)
- Text on dark: white headings, lightened warm-gray for body
- Yellow (#E8B912): dominant accent — prices, CTAs, highlights, decorative elements
- Cards: brand-black (#1A1A1A) with subtle borders
- Exceptions: checkout form + order tracker keep lighter backgrounds

## Component Changes

### globals.css
- Body bg flips to brand-dark
- Add yellow glow utility class

### Header
- Already dark, minor tweaks: bolder yellow CTA

### Hero
- Keep dark bg, amplify yellow presence
- Add yellow glow/gradient effects for energy

### Catalog
- Dark bg instead of cream
- Section title in white with yellow keyword highlight

### Product Cards
- Dark card bg (brand-black), white text
- Yellow price display (like their tabela de precos posts)
- Yellow "Adicionar" button (brand primary CTA color)
- Volume badge in yellow

### Features
- Dark bg, bolder yellow icon circles, white headings

### FAQ
- Dark bg, dark card, yellow hover accents

### Footer
- Already dark, add yellow top border accent

### Cart Sidebar + Cart Items
- Dark bg, yellow totals, yellow checkout button

### Unchanged
- Checkout form: lighter theme for usability
- Order tracker: lighter theme for readability
- All component logic, state, animations
- Framer Motion patterns
- Layout structure and responsive grid
- Storefront architecture (hero prop, children)
- Font pairing: Playfair Display + DM Sans
