import { VscLayoutSidebarLeftOff, VscLayoutSidebarLeft } from "react-icons/vsc";
import { NavLink } from "react-router-dom";
import { PiPlusBold } from "react-icons/pi";

import { GoHome, GoTrophy, GoPerson } from "react-icons/go";
import { SiWikibooks } from "react-icons/si";
import logo from "../../assets/logo.jpg";
import "./navbar.css";

function Navbar({ isCollapsed, onToggle }) {
  const isMobile = window.innerWidth <= 768;
  const navbarItems = [
    { name: "Bosh sahifa", icon: <GoHome />, path: "/" },
    { name: "Kutubxona", icon: <SiWikibooks />, path: "/kutubxona" },
    { name: "Yaratish", icon: <PiPlusBold />, path: "/yaratish" },
    { name: "Reytinglar", icon: <GoTrophy />, path: "/reytinglar" },
    { name: "Profil", icon: <GoPerson />, path: "/profil" },
  ];

  return (
    <>
      <div className={`navbar ${isCollapsed ? "navbar--collapsed" : ""}`}>
        <div className="navbar-header">
          <div className="navbar-logo">
            <img src={logo} alt="Logo" draggable="false" />
          </div>
          <button className="navbar-sidebar-btn" onClick={onToggle}>
            {isCollapsed ? (
              <VscLayoutSidebarLeft />
            ) : (
              <VscLayoutSidebarLeftOff />
            )}
          </button>
        </div>

        <div className="navbar-item">
          {navbarItems.map((item) => (
            <NavLink key={item.path} to={item.path} className="navbar-link">
              <span className="navbar-icon">{item.icon}</span>
              {!isCollapsed && <span className="navbar-text">{item.name}</span>}
            </NavLink>
          ))}
        </div>

        <div className="navbar-user-profil">
          <div className="navbar-user">
            <div className="navbar-user-img">
              <img src={logo} alt="User" draggable="false" />
            </div>
            {!isCollapsed && (
              <span>
                {(() => {
                  try {
                    const u = JSON.parse(localStorage.getItem("ziyo_user"));
                    if (u && u.firstName) return u.firstName;
                    const p = JSON.parse(localStorage.getItem("ziyo_user_profile"));
                    if (p && p.name) return p.name.split(" ")[0];
                  } catch {}
                  return "Profil";
                })()}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mobil-nav">
        <div className="mobil-nav-menyu">
          {navbarItems.map((item) => (
            <NavLink key={item.path} to={item.path} className="mobil-nav-link">
              <span className="mobil-nav-icon">{item.icon}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}

export default Navbar;
