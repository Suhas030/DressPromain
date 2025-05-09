import React from 'react';
import { Link } from 'react-router-dom';

function Homepage() {
  return (
    <>
      <section className="w3l-banner-slider-main">
        <div className="top-header-content">
          <div className="bannerhny-content">
            <div className="content-baner-inf">
              <div id="carouselExampleIndicators" className="carousel slide" data-ride="carousel">
                <ol className="carousel-indicators">
                  <li data-target="#carouselExampleIndicators" data-slide-to="0" className="active"></li>
                </ol>
                <div className="carousel-inner">
                  <div className="carousel-item active">
                    <div className="container">
                      <div className="carousel-caption">
                        <h3>
                          Discover Your<br />Perfect Outfit
                        </h3>
                        <Link to="/find-clothes" className="shop-button btn">
                          Explore Now
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="right-banner">
              <div className="right-1">
                <h4>
                  Rate<br />Your Outfit
                </h4>
                <Link to="/rate-my-fit" className="shop-button btn">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w3l-content-w-photo-6">
        <div className="content-photo-6-mian py-5">
          <div className="container py-lg-5">
            <div className="align-photo-6-inf-cols row">
              <div className="photo-6-inf-right col-lg-6">
                <h3 className="hny-title text-left">Enhance Your Wardrobe with Personalized Suggestions</h3>
                <p>Discover the best fashion trends curated just for you.</p>
                <Link to="/shop" className="read-more btn">
                  Explore Now
                </Link>
              </div>
              <div className="photo-6-inf-left col-lg-6">
                <img src="/images/1.jpg" className="img-fluid" alt="" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w3l-wecome-content-6">
        <div className="ab-content-6-mian py-5">
          <div className="container py-lg-5">
            <div className="welcome-grids row">
              <div className="col-lg-6 mb-lg-0 mb-5">
                <h3 className="hny-title">
                  About <span>Dress</span>Pro
                </h3>
                <p className="my-4">
                  Elevate your fashion game with AI-powered outfit recommendations. Stay trendy with DressPro!
                </p>
                <div className="read">
                  <Link to="/shop" className="read-more btn">
                    Learn More
                  </Link>
                </div>
              </div>
              <div className="col-lg-6 welcome-image">
                <img src="/images/2.jpg" className="img-fluid" alt="" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w3l-specification-6">
        <div className="specification-6-mian py-5">
          <div className="container py-lg-5">
            <div className="row story-6-grids text-left">
              <div className="col-lg-5 story-gd">
                <img src="/images/left2.jpg" className="img-fluid" alt="/" />
              </div>
              <div className="col-lg-7 story-gd pl-lg-4">
                <h3 className="hny-title">Why Choose DressPro?</h3>
                <p>Experience AI-powered fashion recommendations tailored to your style.</p>
                <div className="row story-info-content mt-md-5 mt-4">
                  <div className="col-md-6 story-info">
                    <h5>01. Smart Suggestions</h5>
                    <p>Personalized outfit ideas based on your preferences.</p>
                  </div>
                  <div className="col-md-6 story-info">
                    <h5>02. Trend Insights</h5>
                    <p>Stay ahead with the latest fashion trends and styles.</p>
                  </div>
                  <div className="col-md-6 story-info">
                    <h5>03. AI-Powered Matching</h5>
                    <p>Let AI help you find the best outfit combinations effortlessly.</p>
                  </div>
                  <div className="col-md-6 story-info">
                    <h5>04. Personalized Shopping</h5>
                    <p>Shop for outfits that match your unique style with ease.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Homepage;
