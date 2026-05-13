

import { useState, useEffect } from "react";
import bg from "./assets/bg-liquid.png";

const SHEET_API =
  "https://script.google.com/macros/s/AKfycbwccf2IzIahYmWHuUVkIJqYv88TpVVZCzPyWcdQ_oLoc7rwJL9YhES213LyBEsv-Dny6Q/exec";
export default function MiniSklepLiquidow() {
  const [serverInventory, setServerInventory] = useState({});
  const [selectedFlavor, setSelectedFlavor] = useState(null);

  const [name, setName] = useState(
    () => localStorage.getItem("miniSklepName") || ""
  );

  const [ml, setMl] = useState(
    () => localStorage.getItem("miniSklepMl") || ""
  );

  const [strength, setStrength] = useState(() => {
    const s = localStorage.getItem("miniSklepStrength");
    return s ? Number(s) : null;
  });

  const [base, setBase] = useState(
    () => localStorage.getItem("miniSklepBase") || null
  );

  const [cart, setCart] = useState(() => {
    const c = localStorage.getItem("miniSklepCart");
    return c ? JSON.parse(c) : [];
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isSending, setIsSending] = useState(false);

  // ✅ NOWE
  const [showReferralPopup, setShowReferralPopup] =
    useState(false);

  // ================= HELPERS =================

  const showMessage = (txt, type = "info") => {
    setMessage(txt);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
    }, 4000);
  };

  // ================= FETCH INVENTORY =================

  useEffect(() => {
    const fetchInventory = () => {
      fetch(SHEET_API)
        .then((r) => r.json())
        .then((d) => setServerInventory(d))
        .catch(console.error);
    };

    fetchInventory();

    const interval = setInterval(fetchInventory, 5000);

    return () => clearInterval(interval);
  }, []);

  // ================= SAVE =================

  useEffect(() => {
    localStorage.setItem("miniSklepName", name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem("miniSklepMl", ml);
  }, [ml]);

  useEffect(() => {
    localStorage.setItem("miniSklepStrength", strength ?? "");
  }, [strength]);

  useEffect(() => {
    localStorage.setItem("miniSklepBase", base ?? "");
  }, [base]);

  useEffect(() => {
    localStorage.setItem("miniSklepCart", JSON.stringify(cart));
  }, [cart]);

  // ================= VALIDATION =================

  useEffect(() => {
    if (strength === 36 && base === "nikotyna") {
      setBase(null);
    }
  }, [strength, base]);

  useEffect(() => {
    if (base === "nikotyna" && strength === 36) {
      setStrength(null);
    }
  }, [base, strength]);

  // ================= STOCK =================

  const getReservedInCart = (flavorId) =>
    cart
      .filter((i) => i.flavor.id === flavorId)
      .reduce((s, i) => s + i.ml / 10, 0);

  const getAvailableMl = (flavorId) => {
    const server = serverInventory[flavorId] || 0;
    const reserved = getReservedInCart(flavorId);

    return Math.max(0, (server - reserved) * 10);
  };

  // ================= PRICE =================

  const calculatePrice = (volume, strength, baseType) => {
    let price = 0;
    let p10 = 0,
      p60 = 0;

    if (baseType === "sól") {
      if ([6, 12, 18].includes(strength)) {
        p10 = 15;
        p60 = 79;
      } else {
        p10 = 16;
        p60 = 85;
      }
    } else {
      if ([6, 12].includes(strength)) {
        p10 = 11;
        p60 = 55;
      } else if (strength === 18) {
        p10 = 12;
        p60 = 61;
      } else if (strength === 24) {
        p10 = 13;
        p60 = 67;
      }
    }

    let remainder = volume;

    const num60 = Math.floor(remainder / 60);

    price += num60 * p60;

    remainder %= 60;

    const num30 = Math.floor(remainder / 30);

    if (num30 > 0) {
      const price30 = (() => {
        if (baseType === "nikotyna") {
          if ([6, 12].includes(strength)) return 32.5;
          if (strength === 18) return 35.5;
          if (strength === 24) return 38.5;
        } else {
          if ([6, 12, 18].includes(strength)) return 44.5;
          if ([24, 36].includes(strength)) return 47.5;
        }

        return 0;
      })();

      price += num30 * price30;

      remainder %= 30;
    }

    price += (remainder / 10) * p10;

    return price;
  };

  // ================= ADD TO CART =================

  const addToCart = () => {
    if (!selectedFlavor)
      return showMessage("❌ Wybierz smak", "error");

    if (!ml)
      return showMessage("❌ Podaj ilość", "error");

    if (ml % 10 !== 0)
      return showMessage("❌ Tylko co 10ml", "error");

    if (!strength)
      return showMessage("❌ Wybierz moc", "error");

    if (!base)
      return showMessage("❌ Wybierz bazę", "error");

    const maxMl = getAvailableMl(selectedFlavor.id);

    if (ml > maxMl)
      return showMessage(`❌ Max ${maxMl}ml`, "error");

    const price = calculatePrice(
      Number(ml),
      strength,
      base
    );

    setCart([
      ...cart,
      {
        flavor: selectedFlavor,
        ml: Number(ml),
        strength,
        base,
        price,
      },
    ]);

    setMl("");

    showMessage("✅ Dodano do koszyka", "success");
  };

  const removeItem = (idx) =>
    setCart(cart.filter((_, i) => i !== idx));

  // ================= SEND =================

  const sendOrder = async () => {
    if (!name)
      return showMessage("❌ Podaj imię", "error");

    if (cart.length === 0)
      return showMessage("❌ Koszyk pusty", "error");

    if (isSending) return;

    setIsSending(true);

    const orderText = cart
      .map(
        (i) =>
          `${i.flavor.id}/${i.ml}ml/${i.strength}mg/${i.base}/${i.price.toFixed(2)}`
      )
      .join("\n");

    const total = cart.reduce(
      (s, i) => s + i.price,
      0
    );

    const usedAromas = {};

    cart.forEach((i) => {
      usedAromas[i.flavor.id] =
        (usedAromas[i.flavor.id] || 0) + i.ml / 10;
    });

    try {
      await fetch(SHEET_API, {
        method: "POST",
        body: JSON.stringify({
          name,
          orderText,
          total,
          usedAromas,
        }),
      });

      showMessage(
        "✅ Zamówienie wysłane! Odezwij się po odbiór 😎",
        "success"
      );

      // ✅ NOWE
      setShowReferralPopup(true);

      localStorage.clear();

      setCart([]);
      setName("");
      setMl("");
      setStrength(null);
      setBase(null);
      setSelectedFlavor(null);
    } catch {
      showMessage("❌ Błąd wysyłki", "error");
    } finally {
      setIsSending(false);
    }
  };

  const total = cart.reduce(
    (s, i) => s + i.price,
    0
  );

  // ================= CATEGORY =================

  const categoryColors = {
    // TWOJE KATEGORIE
  };

  const flavorCategories = {
    // TWOJE SMAKI
  };

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: 15,
        borderRadius: 12,
        background: `url(${bg}) center/cover`,
        boxShadow: "0 0 20px rgba(0,0,0,.2)",
      }}
    >
      <h2 style={{ textAlign: "center" }}>
        Mini sklep liquidów
      </h2>

      {/* RESZTA TWOJEGO JSX */}

      {/* ✅ NOWY POPUP */}

      {showReferralPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 25,
              borderRadius: 16,
              width: 340,
              textAlign: "center",
              boxShadow: "0 0 25px rgba(0,0,0,.3)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: "#16a34a",
              }}
            >
              🎁 Program poleceń
            </h2>

            <p
              style={{
                lineHeight: 1.6,
                fontSize: 15,
              }}
            >
              Polecaj znajomych i zdobywaj
              <strong> +10ml gratis </strong>
              za każdą poleconą osobę 👀
            </p>

            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #93c5fd",
                borderRadius: 12,
                padding: 12,
                marginTop: 15,
                marginBottom: 12,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              🔥 Polecona osoba również
              otrzyma bonus do pierwszego
              zamówienia.
            </div>

            <div
              style={{
                background: "#fef9c3",
                border: "1px solid #fde047",
                borderRadius: 12,
                padding: 12,
                marginBottom: 18,
                fontSize: 14,
                lineHeight: 1.5,
                color: "#854d0e",
                fontWeight: "bold",
              }}
            >
              📦 Możliwa wysyłka
              do Paczkomatu
              w cenie 10zł
            </div>

            <button
              onClick={() =>
                setShowReferralPopup(false)
              }
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 12,
                background: "#16a34a",
                color: "#fff",
                fontWeight: "bold",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              🔥 Rozumiem
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        @keyframes glowGreen {
          0% { box-shadow: 0 0 0px #22c55e; }
          50% { box-shadow: 0 0 20px #22c55e; }
          100% { box-shadow: 0 0 0px #22c55e; }
        }

        .addBtn {
          transition: all .2s ease;
          font-weight: bold;
        }

        .addBtn:hover {
          transform: scale(1.03);
        }

        .addBtn:active {
          transform: scale(.96);
        }

        .bestPrice {
          animation: glowGreen 1.5s infinite;
        }

        .lowStock {
          animation: pulse 1s infinite;
          color: #dc2626;
          font-weight: bold;
          font-size: 12px;
        }

        .bestseller {
          background: #ef4444;
          color: white;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 10px;
          margin-left: 6px;
          font-weight: bold;
        }

        .progressBox {
          margin-top: 8px;
          background: #fef08a;
          color: #92400e;
          padding: 8px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: bold;
          text-align: center;
          animation: pulse 1.2s infinite;
        }

        .cartFloating {
          position: sticky;
          bottom: 10px;
          background: #111;
          color: #fff;
          padding: 10px 14px;
          border-radius: 12px;
          text-align: center;
          font-weight: bold;
          margin-top: 10px;
          box-shadow: 0 0 20px rgba(0,0,0,.3);
          z-index: 999;
        }

        .successPulse {
          animation: pulse 1s infinite;
        }
      `}</style>
    </div>
  );
}
