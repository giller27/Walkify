import React from "react";
import { href } from "react-router-dom";

interface Props {
  title: string;
  text: string;
  src: string;
  href: string;
}

const Card = ({ title, text, src, href }: Props) => {
  return (
    <div className="card m-4 mt-1 shadow" style={{ width: "20rem" }}>
      <img
        src={src}
        className="card-img-top m-3 rounded-1 shadow"
        style={{ height: "112px", width: "250px", alignItems: "center" }}
        alt="logo"
      />
      <div className="card-body">
        <h5 className="card-title">{title}</h5>
        <p className="card-text">{text}</p>
        <a href={href} className="btn btn-primary">
          Go somewhere
        </a>
      </div>
    </div>
  );
};

export default Card;
