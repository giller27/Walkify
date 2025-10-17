import { useState } from "react";

const Navbar = () => {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <nav className="navbar sticky-top navbar-expand-lg bg-gradient bg-success">
      <div className="container-fluid">
        <a className="navbar-brand" href="#">
          <img
            src="./public/icon.png"
            alt="Logo"
            width="30"
            height="30"
            className="d-inline-block align-text-top"
          />
          <text style={{ fontWeight: "bold" }}> Walkify</text>
        </a>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
          onClick={() => {
            setShowMenu(!showMenu);
          }}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        {showMenu && (
          <div
            className="navbar-collapse  bg-gradient bg-success"
            id="navbarNav"
          >
            <ul className="navbar-nav me-auto my-2 my-lg-0 navbar-nav-scroll">
              <li className="nav-item">
                <a className="nav-link active" aria-current="page" href="#">
                  Home
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#">
                  Features
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="#">
                  Pricing
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link disabled" aria-disabled="true">
                  Disabled
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
