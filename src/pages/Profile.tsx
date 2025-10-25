import User from "../assets/images/user.png"
import 'bootstrap/dist/js/bootstrap.bundle.min.js';


function Profile() {


  return (
    <div>
    <header className="d-flex flex-column align-items-center my-3">
      <img
        src={User}
        height="60"
        width="60"
        className="d-inline-block text-center mx-1 me-2"
        alt="User" />
      <h1 className="mt-2">USER NAME</h1>  
    </header>

      <div className="alert alert-primary alert-dismissible fade show mx-5" role="alert">
  <strong>Wanna break from the ads?</strong> Feel free with <a href="#" className="alert-link">WalkifyPlus</a>. <br/> Just <strong>$2</strong>/month for clean look and no distraction.
  <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>

      <nav className="fs-3 mx-5">
        <hr />
        <div>
          <i className="bi bi-person-vcard mx-3"></i>
          Personal data</div>
        <hr />
        <div>
          <i className="bi bi-shield-lock mx-3"></i>
          Security</div>
        <hr />
        <div>
          <i className="bi bi-translate mx-3"></i>
          Language</div>
        <hr />
        <div>
          <i className="bi bi-envelope-paper mx-3"></i>
          Mailing settings</div>
        <hr />
        <div>
          <i className="bi bi-box-arrow-right mx-3"></i>
          Exit</div>
        <hr />
        <div>
          <i className="bi bi-person-dash mx-3"></i>
          Delete account</div>
        <hr />
      </nav>
    </div>
  )
}

export default Profile;
