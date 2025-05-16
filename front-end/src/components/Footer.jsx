import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
  const topFunction = () => {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  };

  // Add scroll function
  React.useEffect(() => {
    const scrollFunction = () => {
      if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        const movetop = document.getElementById("movetop");
        if (movetop) movetop.style.display = "block";
      } else {
        const movetop = document.getElementById("movetop");
        if (movetop) movetop.style.display = "none";
      }
    };

    window.onscroll = scrollFunction;
    return () => {
      window.onscroll = null;
    };
  }, []);

  return (
    <section className="w3l-footer-22">
      <div className="footer-hny py-5">
        <div className="container py-lg-5">
          <div className="text-txt row">
            <div className="left-side col-lg-4">
              <h3>
                <Link className="logo-footer" to="/">
                  <span className="lohny">D</span>ress<span className="lohny">P</span>ro
                </Link>
              </h3>
              <p>Find Your Perfect Style..</p>
            </div>
          </div>
          <div className="below-section row">
            <button onClick={topFunction} id="movetop" title="Go to top">
              <span className="fa fa-angle-double-up"></span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Footer;