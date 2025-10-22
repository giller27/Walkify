import map from "../assets/images/map.jpg";
import Card from "../Components/Card";

function Favorites() {
  return (
    <div className="bg-success-subtle">
      <h1 className="text-center lh-lg">Favorites</h1>
      <div className="d-flex flex-wrap center justify-content-md-center">
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
        <Card
          title="Card title"
          text="Some quick example text to build on the card title and make up the bulk of the card’s content."
          href="#"
          src={map}
        />
      </div>
    </div>
  );
}

export default Favorites;
