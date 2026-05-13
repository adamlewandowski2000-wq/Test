import { useState, useEffect } from "react";
import bg from "./assets/bg-liquid.png";

const SHEET_API =
  "https://script.google.com/macros/s/AKfycbzzidf4TZnkJ59YeubZQknj_Y3w0blwxNCpXa1LiSe2oEfXYo8CUMnTJXKHUZFuezFR/exec";

export default function MiniSklepLiquidow() {
  const [serverInventory, setServerInventory] =
    useState({});
const [lastOrderTotal, setLastOrderTotal] =
  useState(0);
  const [selectedFlavor, setSelectedFlavor] =
    useState(null);

  const [name, setName] = useState(
    () => localStorage.getItem("miniSklepName") || ""
  );

  const [ml, setMl] = useState(
    () => localStorage.getItem("miniSklepMl") || ""
  );

  const [strength, setStrength] = useState(() => {
    const s = localStorage.getItem(
      "miniSklepStrength"
    );
    return s ? Number(s) : null;
  });

  const [base, setBase] = useState(
    () => localStorage.getItem("miniSklepBase") ||
      null
  );

  const [cart, setCart] = useState(() => {
    const c =
      localStorage.getItem("miniSklepCart");
    return c ? JSON.parse(c) : [];
  });

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("info");

  const [isSending, setIsSending] =
    useState(false);

  const [showReferralPopup, setShowReferralPopup] =
    useState(false);

  const [lastOrderTotal, setLastOrderTotal] =
    useState(0);

  // ================= HELPERS =================

  const showMessage = (
    txt,
    type = "info"
  ) => {
    setMessage(txt);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
    }, 4000);
  };

  // ================= FETCH =================

  useEffect(() => {
    const fetchInventory = () => {
      fetch(SHEET_API)
        .then((r) => r.json())
        .then((d) =>
          setServerInventory(d)
        )
        .catch(console.error);
    };

    fetchInventory();

    const interval = setInterval(
      fetchInventory,
      5000
    );

    return () =>
      clearInterval(interval);
  }, []);

  // ================= SAVE =================

  useEffect(() => {
    localStorage.setItem(
      "miniSklepName",
      name
    );
  }, [name]);

  useEffect(() => {
    localStorage.setItem(
      "miniSklepMl",
      ml
    );
  }, [ml]);

  useEffect(() => {
    localStorage.setItem(
      "miniSklepStrength",
      strength ?? ""
    );
  }, [strength]);

  useEffect(() => {
    localStorage.setItem(
      "miniSklepBase",
      base ?? ""
    );
  }, [base]);

  useEffect(() => {
    localStorage.setItem(
      "miniSklepCart",
      JSON.stringify(cart)
    );
  }, [cart]);

  // ================= VALIDATION =================

  useEffect(() => {
    if (
      strength === 36 &&
      base === "nikotyna"
    ) {
      setBase(null);
    }
  }, [strength, base]);

  useEffect(() => {
    if (
      base === "nikotyna" &&
      strength === 36
    ) {
      setStrength(null);
    }
  }, [base, strength]);

  // ================= STOCK =================

  const getReservedInCart = (
    flavorId
  ) =>
    cart
      .filter(
        (i) => i.flavor.id === flavorId
      )
      .reduce(
        (s, i) => s + i.ml / 10,
        0
      );

  const getAvailableMl = (
    flavorId
  ) => {
    const server =
      serverInventory[flavorId] || 0;

    const reserved =
      getReservedInCart(flavorId);

    return Math.max(
      0,
      (server - reserved) * 10
    );
  };

  // ================= PRICE =================

  const calculatePrice = (
    volume,
    strength,
    baseType
  ) => {
    let price = 0;
    let p10 = 0;
    let p60 = 0;

    if (baseType === "sól") {
      if (
        [6, 12, 18].includes(strength)
      ) {
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

    const num60 = Math.floor(
      remainder / 60
    );

    price += num60 * p60;

    remainder %= 60;

    price +=
      (remainder / 10) * p10;

    return price;
  };

  // ================= ADD TO CART =================

  const addToCart = () => {
    if (!selectedFlavor)
      return showMessage(
        "❌ Wybierz smak",
        "error"
      );

    if (!ml)
      return showMessage(
        "❌ Podaj ilość",
        "error"
      );

    if (ml % 10 !== 0)
      return showMessage(
        "❌ Tylko co 10ml",
        "error"
      );

    if (!strength)
      return showMessage(
        "❌ Wybierz moc",
        "error"
      );

    if (!base)
      return showMessage(
        "❌ Wybierz bazę",
        "error"
      );

    const maxMl =
      getAvailableMl(
        selectedFlavor.id
      );

    if (ml > maxMl)
      return showMessage(
        `❌ Max ${maxMl}ml`,
        "error"
      );

    const price =
      calculatePrice(
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

    showMessage(
      "✅ Dodano do koszyka",
      "success"
    );
  };

  const removeItem = (idx) =>
    setCart(
      cart.filter((_, i) => i !== idx)
    );

  // ================= SEND =================

  const sendOrder = async () => {
    if (!name)
      return showMessage(
        "❌ Podaj imię",
        "error"
      );

    if (cart.length === 0)
      return showMessage(
        "❌ Koszyk pusty",
        "error"
      );

    if (isSending) return;

    setIsSending(true);

    const orderText = cart
      .map(
        (i) =>
          `${i.flavor.id}/${i.ml}ml/${i.strength}mg/${i.base}/${i.price.toFixed(
            2
          )}`
      )
      .join("\n");

    const total = cart.reduce(
      (s, i) => s + i.price,
      0
    );

    const usedAromas = {};

    cart.forEach((i) => {
      usedAromas[i.flavor.id] =
        (usedAromas[i.flavor.id] ||
          0) +
        i.ml / 10;
    });

    try {
      const response = await fetch(
        SHEET_API,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            orderText,
            total,
            usedAromas,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Błąd wysyłki"
        );
      }

      setLastOrderTotal(total);

      setShowReferralPopup(true);

      showMessage(
        "✅ Zamówienie wysłane!",
        "success"
      );

      localStorage.clear();

      setCart([]);
      setName("");
      setMl("");
      setStrength(null);
      setBase(null);
      setSelectedFlavor(null);

    } catch (err) {

      console.error(err);

      showMessage(
        "❌ Problem z wysyłką",
        "error"
      );

    } finally {

      setIsSending(false);

    }
  };

  const total = cart.reduce(
    (s, i) => s + i.price,
    0
  );

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "40px auto",
        padding: 15,
        borderRadius: 12,
        background: `url(${bg}) center/cover`,
        boxShadow:
          "0 0 20px rgba(0,0,0,.2)",
      }}
    >
      <h2
        style={{
          textAlign: "center",
        }}
      >
        Mini sklep liquidów
      </h2>

      <input
        placeholder="Imię i Nazwisko"
        value={name}
        onChange={(e) =>
          setName(e.target.value)
        }
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
          fontSize: 16,
        }}
      />

      <h3>Ilość (ml)</h3>

      <input
        type="number"
        step={10}
        min={10}
        value={ml}
        onChange={(e) =>
          setMl(e.target.value)
        }
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
          fontSize: 16,
        }}
      />

      <button
        onClick={addToCart}
        style={{
          width: "100%",
          padding: 12,
          background: "#22c55e",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
        }}
      >
        ➕ Dodaj do koszyka
      </button>

      {message && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            textAlign: "center",
            fontWeight: "bold",
            background:
              messageType === "error"
                ? "#fecaca"
                : "#bbf7d0",
          }}
        >
          {message}
        </div>
      )}

      <h3>Koszyk</h3>

      {cart.map((i, idx) => (
        <div key={idx}>
          {i.ml}ml —{" "}
          {i.price.toFixed(2)} zł

          <button
            onClick={() =>
              removeItem(idx)
            }
            style={{
              marginLeft: 10,
            }}
          >
            ❌
          </button>
        </div>
      ))}

      <h2
        style={{
          textAlign: "center",
          marginTop: 20,
        }}
      >
        💰 Suma:{" "}
        {total.toFixed(2)} zł
      </h2>

      <button
        disabled={isSending}
        onClick={sendOrder}
        style={{
          width: "100%",
          marginTop: 20,
          padding: 14,
          background: isSending
            ? "#9ca3af"
            : "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 18,
          fontWeight: "bold",
        }}
      >
        {isSending
          ? "⏳ Wysyłanie..."
          : "📤 Wyślij zamówienie"}
      </button>

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
        boxShadow:
          "0 0 25px rgba(0,0,0,.3)",
      }}
    >
      {/* ✅ NOWY NAPIS */}

      <h2
        style={{
          marginTop: 0,
          color: "#16a34a",
          fontSize: 28,
        }}
      >
        ✅ Zamówienie przyjęte
      </h2>

      {/* ✅ KWOTA */}

      <div
        style={{
          background: "#dcfce7",
          border: "2px solid #22c55e",
          borderRadius: 12,
          padding: 15,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: "bold",
            marginBottom: 5,
          }}
        >
          💰 Do zapłaty
        </div>

        <div
          style={{
            fontSize: 34,
            fontWeight: "bold",
            color: "#15803d",
          }}
        >
          {lastOrderTotal.toFixed(2)} zł
        </div>
      </div>

      {/* STARY POPUP */}

      <h3
        style={{
          color: "#16a34a",
        }}
      >
        🎁 Program poleceń
      </h3>

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

@keyframes popupAnim {
  0% {
    transform: scale(.8);
    opacity: 0;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
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
