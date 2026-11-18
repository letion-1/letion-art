"use client";

export default function PaintSplatter() {
  return (
    <>
      <style>{`
        @keyframes paintColorShiftLeft {
          0% {
            filter: hue-rotate(0deg) saturate(1);
          }

          20% {
            filter: hue-rotate(18deg) saturate(1.08);
          }

          40% {
            filter: hue-rotate(-12deg) saturate(1.12);
          }

          60% {
            filter: hue-rotate(22deg) saturate(1.1);
          }

          80% {
            filter: hue-rotate(-8deg) saturate(1.06);
          }

          100% {
            filter: hue-rotate(0deg) saturate(1);
          }
        }

        @keyframes paintColorShiftRight {
          0% {
            filter: hue-rotate(0deg) saturate(1);
          }

          20% {
            filter: hue-rotate(-20deg) saturate(1.08);
          }

          40% {
            filter: hue-rotate(14deg) saturate(1.12);
          }

          60% {
            filter: hue-rotate(-18deg) saturate(1.1);
          }

          80% {
            filter: hue-rotate(10deg) saturate(1.06);
          }

          100% {
            filter: hue-rotate(0deg) saturate(1);
          }
        }

        @keyframes paintColorShiftSmall {
          0% {
            filter: hue-rotate(0deg) saturate(1);
          }

          25% {
            filter: hue-rotate(16deg) saturate(1.1);
          }

          50% {
            filter: hue-rotate(-18deg) saturate(1.12);
          }

          75% {
            filter: hue-rotate(12deg) saturate(1.08);
          }

          100% {
            filter: hue-rotate(0deg) saturate(1);
          }
        }

        .paint-color-shift-left {
          animation: paintColorShiftLeft 16s ease-in-out infinite;
          will-change: filter;
        }

        .paint-color-shift-right {
          animation: paintColorShiftRight 20s ease-in-out infinite;
          will-change: filter;
        }

        .paint-color-shift-small {
          animation: paintColorShiftSmall 13s ease-in-out infinite;
          will-change: filter;
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[10] overflow-hidden"
      >
        {/* =========================================
            LEFT PAINT CLOUD
            ========================================= */}
        <svg
          className="paint-color-shift-left absolute left-[-95px] top-[10%] h-[448px] w-[416px]"
          viewBox="0 0 520 560"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="rough-left-yellow">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.055"
                numOctaves="3"
                seed="22"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="28"
              />
            </filter>

            <filter id="rough-left-red">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.045"
                numOctaves="3"
                seed="11"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="24"
              />
            </filter>

            <filter id="rough-left-purple">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.05"
                numOctaves="3"
                seed="33"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="25"
              />
            </filter>

            <filter id="rough-left-green">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.06"
                numOctaves="3"
                seed="44"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="25"
              />
            </filter>
          </defs>

          {/* YELLOW */}
          <g filter="url(#rough-left-yellow)" opacity="0.58">
            <path
              d="
                M70 68
                C88 36 145 25 194 49
                C237 69 259 108 246 150
                C236 182 202 197 168 208
                C126 220 87 202 66 169
                C48 140 48 101 70 68
              "
              fill="#FFD60A"
            />
          </g>

          {/* RED / PINK */}
          <g filter="url(#rough-left-red)" opacity="0.66">
            <path
              d="
                M235 128
                C257 93 312 89 356 105
                C400 121 419 160 404 201
                C391 236 351 249 316 253
                C279 257 240 237 222 205
                C206 178 216 153 235 128
              "
              fill="#E63963"
            />
          </g>

          {/* PURPLE */}
          <g filter="url(#rough-left-purple)" opacity="0.58">
            <path
              d="
                M92 213
                C111 187 152 184 184 198
                C219 214 226 247 216 278
                C205 312 168 323 132 313
                C99 304 77 277 77 247
                C77 234 83 223 92 213
              "
              fill="#7950C8"
            />
          </g>

          {/* GREEN */}
          <g filter="url(#rough-left-green)" opacity="0.6">
            <path
              d="
                M198 256
                C222 228 267 228 304 245
                C339 261 353 295 342 326
                C329 360 291 375 255 365
                C218 355 194 328 190 296
                C188 281 191 268 198 256
              "
              fill="#69C92F"
            />
          </g>

          {/* ORANGE */}
          <path
            d="
              M39 111
              C52 88 79 82 94 97
              C111 114 99 139 83 146
              C66 153 46 141 39 111Z
            "
            fill="#FF7A00"
            opacity="0.58"
          />

          {/* DRIPS */}
          <path
            d="M105 177 C105 219 105 261 108 303 C109 316 117 321 123 311 C128 304 125 282 126 258 L126 184Z"
            fill="#FFD60A"
            opacity="0.55"
          />

          <path
            d="M166 212 C165 254 165 290 168 334 C169 348 178 352 184 341 C189 333 187 305 187 277 L186 211Z"
            fill="#E63963"
            opacity="0.55"
          />

          <path
            d="M248 330 C248 370 247 405 251 444 C252 457 260 461 266 450 C271 440 269 416 269 392 L268 329Z"
            fill="#69C92F"
            opacity="0.52"
          />

          <path
            d="M319 327 C319 354 319 384 322 415 C323 427 331 430 337 420 C341 412 339 392 339 370 L339 326Z"
            fill="#7950C8"
            opacity="0.48"
          />

          {/* LARGE DROPS */}
          <circle
            cx="62"
            cy="43"
            r="14"
            fill="#FFD60A"
            opacity="0.58"
          />

          <circle
            cx="39"
            cy="168"
            r="9"
            fill="#FFD60A"
            opacity="0.52"
          />

          <circle
            cx="78"
            cy="278"
            r="12"
            fill="#7950C8"
            opacity="0.52"
          />

          <circle
            cx="47"
            cy="352"
            r="7"
            fill="#E63963"
            opacity="0.55"
          />

          <circle
            cx="203"
            cy="71"
            r="8"
            fill="#FF7A00"
            opacity="0.58"
          />

          <circle
            cx="355"
            cy="92"
            r="11"
            fill="#E63963"
            opacity="0.52"
          />

          <circle
            cx="386"
            cy="250"
            r="7"
            fill="#69C92F"
            opacity="0.55"
          />

          {/* MID SPLATTER */}
          <circle cx="22" cy="91" r="4" fill="#E63963" />
          <circle cx="24" cy="122" r="3" fill="#FF7A00" />
          <circle cx="28" cy="202" r="4" fill="#FFD60A" />
          <circle cx="35" cy="238" r="3" fill="#7950C8" />
          <circle cx="31" cy="304" r="4" fill="#69C92F" />
          <circle cx="50" cy="324" r="3" fill="#E63963" />

          <circle cx="121" cy="21" r="3" fill="#E63963" />
          <circle cx="149" cy="16" r="2" fill="#FF7A00" />
          <circle cx="176" cy="28" r="4" fill="#FFD60A" />

          <circle cx="377" cy="56" r="3" fill="#69C92F" />
          <circle cx="411" cy="72" r="4" fill="#FFD60A" />
          <circle cx="437" cy="112" r="2.5" fill="#E63963" />

          {/* FINE SPRAY */}
          <g opacity="0.58">
            <circle cx="93" cy="35" r="1.7" fill="#FFD60A" />
            <circle cx="105" cy="29" r="1.3" fill="#E63963" />
            <circle cx="118" cy="39" r="1.5" fill="#FF7A00" />
            <circle cx="136" cy="44" r="1.8" fill="#7950C8" />
            <circle cx="153" cy="35" r="1.2" fill="#69C92F" />
            <circle cx="172" cy="50" r="1.5" fill="#E63963" />

            <circle cx="344" cy="40" r="1.5" fill="#E63963" />
            <circle cx="362" cy="48" r="1.2" fill="#FFD60A" />
            <circle cx="381" cy="35" r="1.8" fill="#69C92F" />
            <circle cx="397" cy="50" r="1.4" fill="#7950C8" />
            <circle cx="419" cy="61" r="1.8" fill="#FF7A00" />

            <circle cx="48" cy="188" r="1.5" fill="#FFD60A" />
            <circle cx="54" cy="214" r="1.2" fill="#E63963" />
            <circle cx="47" cy="252" r="1.6" fill="#69C92F" />
            <circle cx="61" cy="267" r="1.3" fill="#7950C8" />

            <circle cx="359" cy="182" r="1.7" fill="#E63963" />
            <circle cx="374" cy="196" r="1.2" fill="#FFD60A" />
            <circle cx="390" cy="211" r="1.5" fill="#69C92F" />
            <circle cx="402" cy="225" r="1.2" fill="#7950C8" />
          </g>
        </svg>

        {/* =========================================
            RIGHT PAINT CLOUD
            ========================================= */}
        <svg
          className="paint-color-shift-right absolute right-[-105px] top-[46%] h-[456px] w-[424px]"
          viewBox="0 0 530 570"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="rough-right-blue">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.05"
                numOctaves="3"
                seed="61"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="28"
              />
            </filter>

            <filter id="rough-right-purple">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.05"
                numOctaves="3"
                seed="72"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="25"
              />
            </filter>

            <filter id="rough-right-pink">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.055"
                numOctaves="3"
                seed="83"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="26"
              />
            </filter>

            <filter id="rough-right-green">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.06"
                numOctaves="3"
                seed="94"
                result="noise"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="25"
              />
            </filter>
          </defs>

          {/* BLUE */}
          <g filter="url(#rough-right-blue)" opacity="0.62">
            <path
              d="
                M276 63
                C313 34 365 36 408 60
                C453 86 469 126 455 165
                C441 203 402 219 363 220
                C321 222 279 202 260 169
                C244 140 251 89 276 63
              "
              fill="#2AA9D6"
            />
          </g>

          {/* PURPLE */}
          <g filter="url(#rough-right-purple)" opacity="0.58">
            <path
              d="
                M87 129
                C106 101 147 94 181 108
                C214 121 230 154 221 188
                C212 221 179 239 145 235
                C110 231 87 208 80 176
                C77 159 79 142 87 129
              "
              fill="#7046C8"
            />
          </g>

          {/* PINK */}
          <g filter="url(#rough-right-pink)" opacity="0.55">
            <path
              d="
                M168 250
                C188 220 231 217 264 231
                C300 246 313 280 302 313
                C291 346 254 360 218 354
                C184 349 160 324 157 294
                C155 279 160 263 168 250
              "
              fill="#F03E88"
            />
          </g>

          {/* GREEN */}
          <g filter="url(#rough-right-green)" opacity="0.56">
            <path
              d="
                M282 292
                C304 263 348 260 383 277
                C417 294 430 328 418 360
                C405 394 369 408 334 401
                C300 394 278 369 274 338
                C272 321 276 305 282 292
              "
              fill="#56C947"
            />
          </g>

          {/* YELLOW */}
          <path
            d="
              M392 164
              C410 140 444 139 461 158
              C479 177 470 204 448 213
              C426 222 400 209 393 188
              C390 180 389 172 392 164Z
            "
            fill="#FFD60A"
            opacity="0.56"
          />

          {/* DRIPS */}
          <path
            d="M356 190 C356 229 356 268 359 304 C360 318 368 323 375 311 C380 301 378 276 378 253 L377 190Z"
            fill="#2AA9D6"
            opacity="0.52"
          />

          <path
            d="M292 333 C292 372 291 409 295 449 C296 462 304 466 310 455 C315 445 313 422 313 398 L312 331Z"
            fill="#F03E88"
            opacity="0.5"
          />

          <path
            d="M386 366 C386 397 386 430 389 462 C390 475 398 479 404 468 C409 458 407 438 407 419 L406 365Z"
            fill="#56C947"
            opacity="0.5"
          />

          {/* LARGE DROPS */}
          <circle
            cx="461"
            cy="58"
            r="14"
            fill="#2AA9D6"
            opacity="0.56"
          />

          <circle
            cx="484"
            cy="116"
            r="8"
            fill="#FFD60A"
            opacity="0.55"
          />

          <circle
            cx="472"
            cy="244"
            r="11"
            fill="#F03E88"
            opacity="0.52"
          />

          <circle
            cx="450"
            cy="382"
            r="8"
            fill="#56C947"
            opacity="0.53"
          />

          <circle
            cx="61"
            cy="101"
            r="10"
            fill="#7046C8"
            opacity="0.5"
          />

          <circle
            cx="45"
            cy="207"
            r="7"
            fill="#2AA9D6"
            opacity="0.5"
          />

          <circle
            cx="67"
            cy="321"
            r="11"
            fill="#FFD60A"
            opacity="0.5"
          />

          {/* MID SPLASH */}
          <circle cx="432" cy="91" r="4" fill="#F03E88" />
          <circle cx="449" cy="144" r="3" fill="#56C947" />
          <circle cx="465" cy="177" r="4" fill="#7046C8" />
          <circle cx="430" cy="217" r="3" fill="#FFD60A" />
          <circle cx="451" cy="282" r="4" fill="#2AA9D6" />
          <circle cx="437" cy="337" r="3" fill="#F03E88" />
          <circle cx="455" cy="416" r="4" fill="#56C947" />

          {/* FINE SPRAY */}
          <g opacity="0.58">
            <circle cx="294" cy="32" r="1.5" fill="#2AA9D6" />
            <circle cx="309" cy="39" r="1.2" fill="#F03E88" />
            <circle cx="326" cy="28" r="1.6" fill="#FFD60A" />
            <circle cx="344" cy="44" r="1.3" fill="#56C947" />
            <circle cx="363" cy="34" r="1.7" fill="#7046C8" />

            <circle cx="162" cy="81" r="1.4" fill="#FFD60A" />
            <circle cx="176" cy="73" r="1.6" fill="#F03E88" />
            <circle cx="191" cy="85" r="1.2" fill="#56C947" />
            <circle cx="203" cy="92" r="1.8" fill="#2AA9D6" />

            <circle cx="113" cy="249" r="1.4" fill="#2AA9D6" />
            <circle cx="126" cy="267" r="1.2" fill="#7046C8" />
            <circle cx="108" cy="286" r="1.6" fill="#FFD60A" />
            <circle cx="122" cy="308" r="1.4" fill="#F03E88" />

            <circle cx="418" cy="352" r="1.5" fill="#56C947" />
            <circle cx="433" cy="369" r="1.2" fill="#2AA9D6" />
            <circle cx="446" cy="389" r="1.6" fill="#FFD60A" />
            <circle cx="423" cy="405" r="1.3" fill="#F03E88" />
          </g>
        </svg>

        {/* =========================================
            SMALL MULTICOLOR SPLASH
            ========================================= */}
        <svg
          className="paint-color-shift-small absolute left-[9%] top-[68%] h-[144px] w-[144px]"
          viewBox="0 0 180 180"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="
              M41 78
              C29 66 34 49 49 44
              C63 39 76 48 77 62
              C78 77 65 88 52 87
              C47 87 44 83 41 78Z
            "
            fill="#EF233C"
            opacity="0.7"
          />

          <path
            d="
              M78 91
              C67 80 73 65 87 61
              C101 57 114 67 113 81
              C112 95 100 105 87 104
              C83 103 80 98 78 91Z
            "
            fill="#00B4D8"
            opacity="0.7"
          />

          <path
            d="
              M98 126
              C89 116 95 103 108 101
              C120 99 130 108 129 120
              C128 133 117 141 106 139
              C102 138 100 133 98 126Z
            "
            fill="#FFB703"
            opacity="0.72"
          />

          <circle cx="32" cy="61" r="4" fill="#7B2CBF" />
          <circle cx="24" cy="94" r="2" fill="#F72585" />
          <circle cx="55" cy="31" r="3" fill="#FB8500" />
          <circle cx="106" cy="41" r="4" fill="#43AA8B" />
          <circle cx="135" cy="68" r="2.5" fill="#F72585" />
          <circle cx="143" cy="102" r="4" fill="#4361EE" />
          <circle cx="132" cy="145" r="2.5" fill="#FB8500" />
        </svg>
      </div>
    </>
  );
}