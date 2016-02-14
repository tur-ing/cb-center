'use strict';

const React = require('react');
const when = require('when');
const ReactDOM = require('react-dom');
const client = require('./client');
const follow = require('./follow'); // function to hop multiple links by "rel"
const root = '/api';
//
import AppBar from 'material-ui/lib/app-bar';
import Table from 'material-ui/lib/table/table';
import TableHeaderColumn from 'material-ui/lib/table/table-header-column';
import TableRow from 'material-ui/lib/table/table-row';
import TableHeader from 'material-ui/lib/table/table-header';
import TableRowColumn from 'material-ui/lib/table/table-row-column';
import TableBody from 'material-ui/lib/table/table-body';
import Dialog from 'material-ui/lib/dialog';
import FlatButton from 'material-ui/lib/flat-button';
import RaisedButton from 'material-ui/lib/raised-button';
import TextField from 'material-ui/lib/text-field';

class App extends React.Component {

	constructor(props) {
		super(props);
		this.state = {farmers: [], attributes: [], pageSize: 2, links: {}};
		this.updatePageSize = this.updatePageSize.bind(this);
		this.onCreate = this.onCreate.bind(this);
		this.onUpdate = this.onUpdate.bind(this);
		this.onDelete = this.onDelete.bind(this);
		this.onNavigate = this.onNavigate.bind(this);
	}

	// tag::follow-2[]
	loadFromServer(pageSize) {
		follow(client, root, [
			{rel: 'farmers', params: {size: pageSize}}]
		).then(farmerCollection => {
			return client({
				method: 'GET',
				path: farmerCollection.entity._links.profile.href,
				headers: {'Accept': 'application/schema+json'}
			}).then(schema => {
				this.schema = schema.entity;
				this.links = farmerCollection.entity._links;
				return farmerCollection;
			});
		}).then(farmerCollection => {
			return farmerCollection.entity._embedded.farmers.map(farmer =>
					client({
						method: 'GET',
						path: farmer._links.self.href
					})
			);
		}).then(farmerPromises => {
			return when.all(farmerPromises);
		}).done(farmers => {
			this.setState({
				farmers: farmers,
				attributes: Object.keys(this.schema.properties),
				pageSize: pageSize,
				links: this.links
			});
		});
	}
	// end::follow-2[]

	// tag::create[]
	onCreate(newFarmer) {
		var self = this;
		follow(client, root, ['farmers']).then(response => {
			return client({
				method: 'POST',
				path: response.entity._links.self.href,
				entity: newFarmer,
				headers: {'Content-Type': 'application/json'}
			})
		}).then(response => {
			return follow(client, root, [
				{rel: 'farmers', params: {'size': this.state.pageSize}}]);
		}).done(response => {
			self.onNavigate(response.entity._links.last.href);
		});
	}
	// end::create[]

	// tag::update[]
	onUpdate(farmer, updatedFarmer) {
		client({
			method: 'PUT',
			path: farmer.entity._links.self.href,
			entity: updatedFarmer,
			headers: {
				'Content-Type': 'application/json',
				'If-Match': farmer.headers.Etag
			}
		}).done(response => {
			this.loadFromServer(this.state.pageSize);
		}, response => {
			if (response.status.code === 412) {
				alert('DENIED: Unable to update ' +
					farmer.entity._links.self.href + '. Your copy is stale.');
			}
		});
	}
	// end::update[]

	// tag::delete[]
	onDelete(farmer) {
		client({method: 'DELETE', path: farmer._links.self.href}).done(response => {
			this.loadFromServer(this.state.pageSize);
		});
	}
	// end::delete[]

	// tag::navigate[]
	onNavigate(navUri) {
		client({
			method: 'GET',
			path: navUri
		}).then(farmerCollection => {
			this.links = farmerCollection.entity._links;

			return farmerCollection.entity._embedded.farmers.map(farmer =>
					client({
						method: 'GET',
						path: farmer._links.self.href
					})
			);
		}).then(farmerPromises => {
			return when.all(farmerPromises);
		}).done(farmers => {
			this.setState({
				farmers: farmers,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});
	}
	// end::navigate[]

	// tag::update-page-size[]
	updatePageSize(pageSize) {
		if (pageSize !== this.state.pageSize) {
			this.loadFromServer(pageSize);
		}
	}
	// end::update-page-size[]

	// tag::follow-1[]
	componentDidMount() {
		this.loadFromServer(this.state.pageSize);
	}
	// end::follow-1[]

	render() {
		return (
			<div>
			  	<AppBar
			  	  title="Cibon"
			      iconClassNameRight="muidocs-icon-navigation-expand-more" />
				<CreateDialog attributes={this.state.attributes} onCreate={this.onCreate}/>
				<FarmerList farmers={this.state.farmers}
							  links={this.state.links}
							  pageSize={this.state.pageSize}
							  onNavigate={this.onNavigate}
							  onDelete={this.onDelete}
							  updatePageSize={this.updatePageSize}/>
			</div>
		)
	}
}

// tag::create-dialog[]
class CreateDialog extends React.Component {

	constructor(props) {
		super(props);
		this.state = {open: false};
		this.handleSubmit = this.handleSubmit.bind(this);
		this.handleOpen = this.handleOpen.bind(this);
		this.handleClose = this.handleClose.bind(this);
	}

	handleSubmit(e) {
		e.preventDefault();
		var newFarmer = {};
		this.props.attributes.forEach(attribute => {
			newFarmer[attribute] = ReactDOM.findDOMNode(this.refs[attribute]).value.trim();
		});
		this.props.onCreate(newFarmer);

		// clear out the dialog's inputs
		this.props.attributes.forEach(attribute => {
			ReactDOM.findDOMNode(this.refs[attribute]).value = '';
		});

		// Navigate away from the dialog to hide it.
		window.location = "#";
	}

	handleOpen(e) {
		e.preventDefault();
		this.setState({open: true});
	}

    handleClose(e) {
    	e.preventDefault();
    	this.setState({open: false});
    }

	render() {
		var inputs = this.props.attributes.map(attribute =>
			<span key={attribute}>
				<TextField type="text" floatingLabelText={attribute} val={attribute} /><br/>
			</span>
		);

	    const actions = [
	          <FlatButton
	            label="Abbrechen"
	            secondary={true}
	            onMouseDown={this.handleClose}
	            onTouchTap={this.handleClose}
	          />,
	          <FlatButton
	            label="Speichern"
	            primary={true}
	            onMouseDown={this.handleClose}
	            onTouchTap={this.handleClose}
	          />,
	    ];

		return (
			<div>
				<RaisedButton label="Neuer Bauer" onMouseDown={this.handleOpen} onTouchTap={this.handleOpen} />

				<Dialog
		          title="Neuer Bauer"
		          actions={actions}
		          modal={false}
		          open={this.state.open}
		          onRequestClose={this.handleClose}
		        >
					<div>
						<form>
							{inputs}
							<button onClick={this.handleSubmit}>Create</button>
						</form>
					</div>
				</Dialog>
			</div>
		)
	}

}
// end::create-dialog[]

//tag::update-dialog[]
class UpdateDialog extends React.Component {

	constructor(props) {
		super(props);
		this.handleSubmit = this.handleSubmit.bind(this);
	}

	handleSubmit(e) {
		e.preventDefault();
		var updatedFarmer = {};
		this.props.attributes.forEach(attribute => {
			updatedFarmer[attribute] = React.findDOMNode(this.refs[attribute]).value.trim();
		});
		this.props.onUpdate(this.props.farmer, updatedFarmer);
		window.location = "#";
	}

	render() {
		var inputs = this.props.attributes.map(attribute =>
				<p key={this.props.farmer.entity[attribute]}>
					<input type="text" placeholder={attribute}
						   defaultValue={this.props.farmer.entity[attribute]}
						   ref={attribute} className="field" />
				</p>
		);

		var dialogId = "updateEmployee-" + this.props.farmer.entity._links.self.href;

		return (
			<div key={this.props.farmer.entity._links.self.href}>
				<a href={"#" + dialogId}>Update</a>
				<div id={dialogId} className="modalDialog">
					<div>
						<a href="#" title="Close" className="close">X</a>

						<h2>Update an employee</h2>

						<form>
							{inputs}
							<button onClick={this.handleSubmit}>Update</button>
						</form>
					</div>
				</div>
			</div>
		)
	}

};
// end::update-dialog[]

class FarmerList extends React.Component {

	constructor(props) {
		super(props);
		this.handleNavFirst = this.handleNavFirst.bind(this);
		this.handleNavPrev = this.handleNavPrev.bind(this);
		this.handleNavNext = this.handleNavNext.bind(this);
		this.handleNavLast = this.handleNavLast.bind(this);
		this.handleInput = this.handleInput.bind(this);
	}

	// tag::handle-page-size-updates[]
	handleInput(e) {
		e.preventDefault();
		var pageSize = React.findDOMNode(this.refs.pageSize).value;
		if (/^[0-9]+$/.test(pageSize)) {
			this.props.updatePageSize(pageSize);
		} else {
			React.findDOMNode(this.refs.pageSize).value =
				pageSize.substring(0, pageSize.length - 1);
		}
	}
	// end::handle-page-size-updates[]

	// tag::handle-nav[]
	handleNavFirst(e){
		e.preventDefault();
		this.props.onNavigate(this.props.links.first.href);
	}

	handleNavPrev(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.prev.href);
	}

	handleNavNext(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.next.href);
	}

	handleNavLast(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.last.href);
	}
	// end::handle-nav[]

	// tag::farmer-list-render[]
	render() {
		var farmers = this.props.farmers.map(farmer =>
				<Farmer key={farmer.entity._links.self.href}
						  farmer={farmer}
						  attributes={this.props.attributes}
						  onUpdate={this.props.onUpdate}
						  onDelete={this.props.onDelete}/>
		);

		var navLinks = [];
		if ("first" in this.props.links) {
			navLinks.push(<button key="first" onClick={this.handleNavFirst}>&lt;&lt;</button>);
		}
		if ("prev" in this.props.links) {
			navLinks.push(<button key="prev" onClick={this.handleNavPrev}>&lt;</button>);
		}
		if ("next" in this.props.links) {
			navLinks.push(<button key="next" onClick={this.handleNavNext}>&gt;</button>);
		}
		if ("last" in this.props.links) {
			navLinks.push(<button key="last" onClick={this.handleNavLast}>&gt;&gt;</button>);
		}

		return (
			<div>
				<input ref="pageSize" defaultValue={this.props.pageSize} onInput={this.handleInput}/>
				<Table>
					<TableHeader>
					<TableRow>
						<TableHeaderColumn>Name</TableHeaderColumn>
						<TableHeaderColumn>Vorname</TableHeaderColumn>
						<TableHeaderColumn>Nachname</TableHeaderColumn>
						<TableHeaderColumn></TableHeaderColumn>
						<TableHeaderColumn></TableHeaderColumn>
					</TableRow>
					</TableHeader>
					<TableBody>
					{farmers}
					</TableBody>
				</Table>
				<div>
					{navLinks}
				</div>
			</div>
		)
	}
	// end::farmer-list-render[]
}

// tag::farmer[]
class Farmer extends React.Component {

	constructor(props) {
		super(props);
		this.handleDelete = this.handleDelete.bind(this);
	}

	handleDelete() {
		this.props.onDelete(this.props.farmer);
	}

	render() {
		return (
			<TableRow>
				<TableHeaderColumn>{this.props.farmer.entity.firstName}</TableHeaderColumn>
				<TableHeaderColumn>{this.props.farmer.entity.lastName}</TableHeaderColumn>
				<TableHeaderColumn>{this.props.farmer.entity.description}</TableHeaderColumn>
				<TableHeaderColumn>
					<UpdateDialog farmer={this.props.farmer}
								  attributes={this.props.attributes}
								  onUpdate={this.props.onUpdate}/>
				</TableHeaderColumn>
				<TableHeaderColumn>
					<button onClick={this.handleDelete}>Delete</button>
				</TableHeaderColumn>
			</TableRow>
		)
	}
}
// end::farmer[]

ReactDOM.render(
	<App />,
	document.getElementById('react')
)
