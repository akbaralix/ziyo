import { VscLayoutSidebarLeftOff, VscLayoutSidebarLeft } from "react-icons/vsc";
import { NavLink } from "react-router-dom";
import { GoHome, GoTrophy, GoPerson } from "react-icons/go";
import { SiWikibooks } from "react-icons/si";
import { IoGameControllerOutline } from "react-icons/io5";
import logo from "../../assets/hatify-logo.png";
import "./navbar.css";

function Navbar({ isCollapsed, onToggle }) {
  const navbarItems = [
    { name: "Bosh sahifa", icon: <GoHome />, path: "/" },
    { name: "Kutubxona", icon: <SiWikibooks />, path: "/kutubxona" },
    { name: "O'yinlar", icon: <IoGameControllerOutline />, path: "/oyinlar" },
    { name: "Reytinglar", icon: <GoTrophy />, path: "/reytinglar" },
    { name: "Profil", icon: <GoPerson />, path: "/profil" },
  ];

  const getUserData = () => {
    try {
      const u =
        JSON.parse(localStorage.getItem("hatify_user")) ||
        JSON.parse(localStorage.getItem("ziyo_user"));
      if (u) {
        return {
          profilePic: u.profilePic || logo,
          name: u.firstName || (u.name ? u.name.split(" ")[0] : "Profil"),
        };
      }
      const p =
        JSON.parse(localStorage.getItem("hatify_user_profile")) ||
        JSON.parse(localStorage.getItem("ziyo_user_profile"));
      if (p) {
        return {
          profilePic: p.profilePic || logo,
          name: p.firstName || (p.name ? p.name.split(" ")[0] : "Profil"),
        };
      }
    } catch {
      // fallback
    }
    return { profilePic: logo, name: "Profil" };
  };

  const userData = getUserData();

  return (
    <>
      <aside className={`navbar ${isCollapsed ? "navbar--collapsed" : ""}`}>
        <div className="navbar-header">
          <div className="navbar-logo">
            <img src={logo} alt="Hatify" draggable="false" />
          </div>
          <button
            type="button"
            className="navbar-sidebar-btn"
            onClick={onToggle}
            aria-label={isCollapsed ? "Menyuni ochish" : "Menyuni yopish"}
          >
            {isCollapsed ? (
              <VscLayoutSidebarLeft />
            ) : (
              <VscLayoutSidebarLeftOff />
            )}
          </button>
        </div>

        <nav className="navbar-item">
          {navbarItems.map((item) => (
            <NavLink key={item.path} to={item.path} className="navbar-link">
              <span className="navbar-icon">{item.icon}</span>
              {!isCollapsed && <span className="navbar-text">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-user-profil">
          <NavLink to="/profil" className="navbar-user">
            <div className="navbar-user-img">
              <img
                src={userData.profilePic}
                alt={userData.name}
                draggable="false"
              />
            </div>
            {!isCollapsed && <span>{userData.name}</span>}
          </NavLink>
        </div>
      </aside>

      <nav className="mobil-nav">
        <div className="mobil-nav-menyu">
          {navbarItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="mobil-nav-link"
              aria-label={item.name}
            >
              <span className="mobil-nav-icon">{item.icon}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

export default Navbar;
