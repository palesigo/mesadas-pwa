# Gestão de Mesadas (PWA)

PWA offline-first portada de [palesigo/gest-o-mesadas](https://github.com/palesigo/gest-o-mesadas) (Flask + pywebview), com as mesmas regras.

## Regras
- Cofres: Diário 50%, Sonhos 20%, Poupança 18,75%, Doação 6,25%.
- Mesada por defeito: 4 + 2 + 1,5 + 0,5 = 8 € por semana.
- Data de pagamento: sábado. Semanas completas em atraso acumulam dívida, paga (com a mesma distribuição) no pagamento seguinte.
- Gastos só pelo gestor, com valor positivo e saldo suficiente.
- Perfis: gestor (tudo) e criança (só os seus dados).

## Utilização
Login inicial: `admin` / `admin` (altera logo a password).

```bash
python -m http.server 8080   # ou: npx serve .
```
Abre `http://localhost:8080`. O service worker exige HTTP(S), não funciona com `file://`.

## Deploy (GitHub Pages)
Settings → Pages → Source: GitHub Actions. O workflow `.github/workflows/pages.yml` publica em cada push para `main`.

## Estrutura
- `rules.js`: regras de negócio.
- `app.js`: interface e persistência (`localStorage`).
- `sw.js` e `manifest.webmanifest`: PWA. Incrementa `CACHE` em `sw.js` ao alterar ficheiros.

## Limitações
- Dados guardados só no navegador do dispositivo; usa Exportar/Importar JSON como cópia de segurança.
- O login separa perfis mas não é segurança real (sem servidor).
- O ícone é SVG; alguns sistemas (iOS) podem pedir PNG para um ícone ideal.
